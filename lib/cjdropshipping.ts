import type { RawOffer } from "@/types/product";

/**
 * Recherche produit via l'API officielle CJdropshipping (gratuite).
 * https://developers.cjdropshipping.com
 *
 * Entrepôts en Europe (dont UE) pour une partie du catalogue — champ
 * `countryCode`/`warehouseInventoryNum` permettrait de filtrer sur du stock
 * EU, non exploité dans ce MVP pour rester simple.
 *
 * Contrainte API: l'endpoint getAccessToken est limité à 1 appel/5 minutes
 * et le token est valide 180 jours -> on le met en cache en mémoire pour
 * la durée de vie de l'instance serverless plutôt que de le redemander à
 * chaque recherche.
 */

const AUTH_URL =
  "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken";
const SEARCH_URL =
  "https://developers.cjdropshipping.com/api2.0/v1/product/listV2";

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let tokenCache: TokenCache | null = null;
let pendingAuth: Promise<string> | null = null;

interface AuthResponse {
  code: number;
  message?: string;
  data?: {
    accessToken: string;
    accessTokenExpiryDate: string; // ex: "2026-09-18 12:00:00"
  };
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken;
  }

  // Évite les appels concurrents qui violeraient la limite 1/5min
  if (pendingAuth) {
    return pendingAuth;
  }

  const apiKey = process.env.CJDROPSHIPPING_API_KEY;
  if (!apiKey) {
    throw new Error("CJDROPSHIPPING_API_KEY manquante. Voir .env.example.");
  }

  pendingAuth = (async () => {
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });

    if (!res.ok) {
      throw new Error(
        `CJdropshipping auth error: ${res.status} ${await res.text()}`
      );
    }

    const data = (await res.json()) as AuthResponse;

    if (data.code !== 200 || !data.data) {
      throw new Error(
        `CJdropshipping auth failed: ${data.message ?? "raison inconnue"}`
      );
    }

    const expiresAt = new Date(data.data.accessTokenExpiryDate).getTime();
    tokenCache = {
      accessToken: data.data.accessToken,
      // marge de sécurité de 1h avant expiration réelle
      expiresAt: (Number.isFinite(expiresAt) ? expiresAt : Date.now() + 1000 * 60 * 60 * 24) - 60 * 60 * 1000,
    };

    return tokenCache.accessToken;
  })();

  try {
    return await pendingAuth;
  } finally {
    pendingAuth = null;
  }
}

interface CjProduct {
  id: string;
  nameEn: string;
  sku: string;
  bigImage: string;
  sellPrice: string;
  warehouseInventoryNum?: number;
}

interface SearchResponse {
  code: number;
  message?: string;
  data?: {
    content: CjProduct[];
  };
}

export async function searchCjDropshipping(query: string): Promise<RawOffer[]> {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    keyWord: query,
    page: "1",
    size: "20",
  });

  const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
    headers: {
      "CJ-Access-Token": token,
    },
  });

  if (!res.ok) {
    throw new Error(
      `CJdropshipping search error: ${res.status} ${await res.text()}`
    );
  }

  const data = (await res.json()) as SearchResponse;

  if (data.code !== 200) {
    if (data.code === 205 || /no.*result/i.test(data.message ?? "")) {
      return [];
    }
    throw new Error(`CJdropshipping search failed: ${data.message ?? "raison inconnue"}`);
  }

  const items = data.data?.content ?? [];

  return items.map((item) => ({
    supplier: "cjdropshipping" as const,
    title: item.nameEn,
    price: parseFloat(item.sellPrice) || 0,
    // CJ retourne les prix en USD, pas de conversion appliquée dans ce MVP
    currency: "USD",
    shippingCost: null,
    shippingDays: null,
    imageUrl: item.bigImage,
    productUrl: `https://cjdropshipping.com/product/${item.id}.html`,
    rating: null,
    originCountry: "CN",
    isInEuStock: false,
  }));
}
