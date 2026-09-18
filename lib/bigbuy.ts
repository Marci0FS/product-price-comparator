import type { RawOffer } from "@/types/product";

/**
 * Adaptateur BigBuy.
 *
 * L'API officielle BigBuy nécessite le "Pack E-commerce" (89€/mois) —
 * pas d'accès gratuit. Ce module retourne donc des données mockées pour
 * permettre de développer et tester le reste du pipeline (normalisation,
 * calcul de prix total, UI) sans dépendre d'un abonnement payant.
 *
 * Pour activer l'intégration réelle plus tard:
 * 1. Souscrire au Pack E-commerce sur bigbuy.eu
 * 2. Récupérer la clé API (Panneau de contrôle > Synchronise with BigBuy)
 * 3. Remplacer le corps de searchBigBuy() par un appel à
 *    https://api.bigbuy.eu/rest/catalog/products.json avec le header
 *    Authorization: Bearer <BIGBUY_API_KEY>
 *
 * Alternative gratuite à évaluer: CJdropshipping (API officielle gratuite,
 * entrepôts en Europe) — voir lib/cjdropshipping.ts (à créer si besoin).
 */

const USE_MOCK = !process.env.BIGBUY_API_KEY;

const MOCK_OFFERS: RawOffer[] = [
  {
    supplier: "bigbuy",
    title: "[MOCK] Résultat BigBuy — intégration réelle nécessite le Pack E-commerce (89€/mois)",
    price: 0,
    currency: "EUR",
    shippingCost: 0,
    shippingDays: { min: 1, max: 2 },
    imageUrl: "",
    productUrl: "https://www.bigbuy.eu/",
    rating: null,
    originCountry: "ES",
    isInEuStock: true,
  },
];

export async function searchBigBuy(query: string): Promise<RawOffer[]> {
  if (USE_MOCK) {
    console.warn(
      `[bigbuy] BIGBUY_API_KEY absente — retour de données mockées pour la requête "${query}".`
    );
    return MOCK_OFFERS;
  }

  const apiKey = process.env.BIGBUY_API_KEY;
  const res = await fetch(
    `https://api.bigbuy.eu/rest/catalog/products.json?search=${encodeURIComponent(
      query
    )}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`BigBuy API error: ${res.status} ${await res.text()}`);
  }

  const items = (await res.json()) as Array<{
    id: number;
    name: string;
    wholesalePrice?: number;
    retailPrice?: number;
    image?: string;
  }>;

  return items.map((item) => ({
    supplier: "bigbuy" as const,
    title: item.name,
    price: item.retailPrice ?? item.wholesalePrice ?? 0,
    currency: "EUR",
    shippingCost: null,
    shippingDays: { min: 1, max: 2 },
    imageUrl: item.image ?? "",
    productUrl: `https://www.bigbuy.eu/en/search?search=${encodeURIComponent(
      item.name
    )}`,
    rating: null,
    originCountry: "ES",
    isInEuStock: true,
  }));
}
