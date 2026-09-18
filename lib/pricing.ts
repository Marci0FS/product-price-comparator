import type { RawOffer, EnrichedOffer } from "@/types/product";

/**
 * Estime le prix total réel d'une offre (produit + port + TVA/douane
 * probable) selon les règles françaises/UE 2026:
 * - Hors UE, commande < 150€ : TVA (20%) normalement déjà perçue à la
 *   source par la plateforme, pas de droits de douane.
 * - Hors UE, commande >= 150€ : TVA + droits de douane à payer au
 *   transporteur (non inclus dans le prix affiché).
 * - Origine UE (ex: BigBuy/Espagne) : TVA intracommunautaire déjà incluse,
 *   pas de surprise douanière.
 */
const FR_VAT_RATE = 0.2;
const CUSTOMS_DUTY_THRESHOLD_EUR = 150;

// Taux de change approximatifs pour normaliser en EUR avant comparaison.
// Pas de taux temps réel dans ce MVP — à remplacer par une API de change
// si la précision devient importante.
const APPROX_EUR_RATE: Record<string, number> = {
  EUR: 1,
  USD: 0.92,
};

function toEur(amount: number, currency: string): number {
  return amount * (APPROX_EUR_RATE[currency] ?? 1);
}

export function enrichOffer(offer: RawOffer): EnrichedOffer {
  const priceEur = toEur(offer.price, offer.currency);
  const shippingEur = toEur(offer.shippingCost ?? 0, offer.currency);
  const baseTotal = priceEur + shippingEur;

  if (offer.isInEuStock) {
    return {
      ...offer,
      estimatedTotalPrice: Math.round(baseTotal * 100) / 100,
      customsWarning: false,
    };
  }

  // Hors UE
  if (baseTotal < CUSTOMS_DUTY_THRESHOLD_EUR) {
    // TVA supposée déjà incluse dans le prix affiché par la plateforme
    return {
      ...offer,
      estimatedTotalPrice: Math.round(baseTotal * 100) / 100,
      customsWarning: false,
    };
  }

  // Au-delà de 150€ : TVA + droits de douane non inclus, à estimer
  const estimatedVat = baseTotal * FR_VAT_RATE;
  const estimatedTotal = baseTotal + estimatedVat;

  return {
    ...offer,
    estimatedTotalPrice: Math.round(estimatedTotal * 100) / 100,
    customsWarning: true,
  };
}

export function enrichOffers(offers: RawOffer[]): EnrichedOffer[] {
  return offers
    .map(enrichOffer)
    .sort((a, b) => a.estimatedTotalPrice - b.estimatedTotalPrice);
}
