import type { RawOffer } from "@/types/product";

/**
 * Recherche produit AliExpress via une API tierce non-officielle (RapidAPI).
 *
 * Choix assumé: le programme AliExpress Affiliate officiel demande une pièce
 * d'identité (passeport/CNI) pour l'inscription, ce qui a été explicitement
 * refusé pour ce projet. On passe donc par une API RapidAPI qui scrape les
 * données publiques d'AliExpress sans vérification d'identité.
 *
 * Contrepartie: moins stable qu'une API officielle (peut casser si
 * AliExpress change son site), et soumis aux CGU de RapidAPI + AliExpress.
 *
 * À configurer: choisir une API sur https://rapidapi.com/collection/aliexpress-api
 * (ex: "AliExpress Data" ou équivalent avec un tier gratuit), puis renseigner
 * RAPIDAPI_KEY et RAPIDAPI_ALIEXPRESS_HOST dans .env.local
 */

// Schéma réel observé sur l'endpoint item_search_2 de "Aliexpress DataHub"
// (RapidAPI, host: aliexpress-datahub.p.rapidapi.com) — vérifié par appel direct.
interface RapidApiAliExpressItem {
  item: {
    itemId: string;
    title: string;
    sales: string | number;
    itemUrl: string; // protocol-relative, ex: "//www.aliexpress.com/item/...html"
    image: string; // protocol-relative
    sku: {
      def: {
        price: number | null;
        promotionPrice: number | null;
      };
    };
    averageStarRate: number | null;
    type: "ad" | "natural";
  };
  delivery: unknown;
  sellingPoints: unknown;
}

interface RapidApiAliExpressResponse {
  result?: {
    status?: { code: number; data: string };
    resultList?: RapidApiAliExpressItem[];
  };
}

function withProtocol(url: string): string {
  return url.startsWith("//") ? `https:${url}` : url;
}

export async function searchAliExpress(query: string): Promise<RawOffer[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_ALIEXPRESS_HOST;

  if (!apiKey || !host) {
    throw new Error(
      "RAPIDAPI_KEY ou RAPIDAPI_ALIEXPRESS_HOST manquant. Voir .env.example."
    );
  }

  const params = new URLSearchParams({
    q: query,
    page: "1",
    region: "FR",
    currency: "EUR",
    locale: "fr_FR",
  });

  const res = await fetch(
    `https://${host}/item_search_2?${params.toString()}`,
    {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": host,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`AliExpress API error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as RapidApiAliExpressResponse;

  if (data.result?.status?.data === "error") {
    // ex: aucun résultat, endpoint temporairement indisponible
    return [];
  }

  const items = data.result?.resultList ?? [];

  return items
    .filter((entry) => entry.item)
    .map((entry) => {
      const { item } = entry;
      const price = item.sku.def.promotionPrice ?? item.sku.def.price ?? 0;

      return {
        supplier: "aliexpress" as const,
        title: item.title,
        price,
        currency: "EUR",
        shippingCost: null,
        shippingDays: null,
        imageUrl: withProtocol(item.image),
        productUrl: withProtocol(item.itemUrl),
        rating: item.averageStarRate,
        originCountry: "CN",
        isInEuStock: false,
      };
    });
}
