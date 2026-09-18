import { NextRequest, NextResponse } from "next/server";
import { identifyProductKeywords } from "@/lib/vision";
import { searchAliExpress } from "@/lib/aliexpress";
import { searchBigBuy } from "@/lib/bigbuy";
import { searchCjDropshipping } from "@/lib/cjdropshipping";
import { enrichOffers } from "@/lib/pricing";
import type { RawOffer, SearchResult, SupplierId } from "@/types/product";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { imageBase64?: string; query?: string };

    let keywords: string[];

    if (body.query) {
      // Recherche directe par texte (utile pour tester sans consommer
      // le quota Vision API)
      keywords = [body.query];
    } else if (body.imageBase64) {
      keywords = await identifyProductKeywords(body.imageBase64);
    } else {
      return NextResponse.json(
        { error: "imageBase64 ou query requis" },
        { status: 400 }
      );
    }

    if (keywords.length === 0) {
      return NextResponse.json(
        { error: "Impossible d'identifier le produit dans l'image" },
        { status: 422 }
      );
    }

    const searchQuery = keywords.join(" ");
    const errors: SearchResult["errors"] = [];
    const allOffers: RawOffer[] = [];

    const suppliers: {
      id: SupplierId;
      fn: (q: string) => Promise<RawOffer[]>;
    }[] = [
      { id: "aliexpress", fn: searchAliExpress },
      { id: "bigbuy", fn: searchBigBuy },
      { id: "cjdropshipping", fn: searchCjDropshipping },
    ];

    const results = await Promise.allSettled(
      suppliers.map((s) => s.fn(searchQuery))
    );

    results.forEach((result, i) => {
      const supplierId = suppliers[i].id;
      if (result.status === "fulfilled") {
        allOffers.push(...result.value);
      } else {
        errors.push({
          supplier: supplierId,
          message:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    });

    const response: SearchResult = {
      query: searchQuery,
      keywords,
      offers: enrichOffers(allOffers),
      errors,
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}
