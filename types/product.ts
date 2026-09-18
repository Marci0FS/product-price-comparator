export type SupplierId = "aliexpress" | "bigbuy" | "cjdropshipping";

export interface RawOffer {
  supplier: SupplierId;
  title: string;
  price: number;
  currency: string;
  shippingCost: number | null;
  shippingDays: { min: number; max: number } | null;
  imageUrl: string;
  productUrl: string;
  rating: number | null;
  originCountry: string | null;
  isInEuStock: boolean;
}

export interface EnrichedOffer extends RawOffer {
  estimatedTotalPrice: number;
  customsWarning: boolean;
}

export interface SearchResult {
  query: string;
  keywords: string[];
  offers: EnrichedOffer[];
  errors: { supplier: SupplierId; message: string }[];
}
