"use client";

import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "@/types/product";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // enlève le préfixe "data:image/...;base64,"
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function selectImageFile(file: File | null) {
    if (file && !file.type.startsWith("image/")) {
      setError("Le fichier déposé n'est pas une image.");
      return;
    }
    setImageFile(file);
    setError(null);
  }

  // Génère/nettoie l'URL d'aperçu à chaque changement d'image
  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // Support du collage (Ctrl+V) d'une image depuis le presse-papiers
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((it) =>
        it.type.startsWith("image/")
      );
      if (item) {
        const file = item.getAsFile();
        if (file) selectImageFile(file);
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  async function runSearch() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload: { query?: string; imageBase64?: string } = {};

      if (imageFile) {
        payload.imageBase64 = await fileToBase64(imageFile);
      } else if (query.trim()) {
        payload.query = query.trim();
      } else {
        setError("Ajoute une image ou un texte de recherche.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur inconnue");
        return;
      }

      setResult(data as SearchResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black px-6 py-12">
      <main className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Comparateur produit — AliExpress vs BigBuy
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          MVP: identifie un produit par image (ou texte) et compare les prix
          totaux estimés (produit + port + douane probable) entre AliExpress
          et BigBuy.
        </p>

        <div className="mt-8 flex flex-col gap-4 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
          <div>
            <label className="block text-sm font-medium text-black dark:text-zinc-50">
              Recherche par texte (ne consomme pas le quota Vision API)
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ex: wireless earbuds"
              className="mt-1 w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-black dark:text-zinc-50"
            />
          </div>

          <div className="text-center text-xs text-zinc-400">— ou —</div>

          <div>
            <label className="block text-sm font-medium text-black dark:text-zinc-50">
              Recherche par image
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                selectImageFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={`mt-1 flex cursor-pointer flex-col items-center justify-center gap-2 rounded border-2 border-dashed p-6 text-center transition-colors ${
                isDraggingOver
                  ? "border-black bg-zinc-100 dark:border-zinc-50 dark:bg-zinc-800"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {imagePreviewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreviewUrl}
                    alt="Aperçu"
                    className="max-h-40 rounded object-contain"
                  />
                  <div className="text-xs text-zinc-500">{imageFile?.name}</div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectImageFile(null);
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Retirer l&apos;image
                  </button>
                </>
              ) : (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  Glisse-dépose une image, colle-la (Ctrl+V) ou{" "}
                  <span className="underline">clique pour parcourir</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => selectImageFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </div>

          <button
            onClick={runSearch}
            disabled={loading}
            className="mt-2 rounded bg-black dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-black disabled:opacity-50"
          >
            {loading ? "Recherche en cours..." : "Rechercher"}
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-8">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Mots-clés identifiés: {result.keywords.join(", ")}
            </h2>

            {result.errors.length > 0 && (
              <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                {result.errors.map((e, i) => (
                  <div key={i}>
                    {e.supplier}: {e.message}
                  </div>
                ))}
              </div>
            )}

            <ul className="mt-4 flex flex-col gap-3">
              {result.offers.map((offer, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-zinc-500">
                        {offer.supplier}
                      </div>
                      <div className="text-sm font-medium text-black dark:text-zinc-50">
                        {offer.title}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {offer.isInEuStock
                          ? "Stock UE"
                          : `Origine: ${offer.originCountry ?? "inconnue"}`}
                        {offer.shippingDays &&
                          ` · ${offer.shippingDays.min}-${offer.shippingDays.max} jours`}
                      </div>
                      {offer.customsWarning && (
                        <div className="mt-1 text-xs text-amber-600">
                          ⚠ Douane/TVA possible au-delà de 150€ (non inclus dans le prix affiché)
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-black dark:text-zinc-50">
                        {offer.estimatedTotalPrice.toFixed(2)} €
                      </div>
                      <a
                        href={offer.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Voir l&apos;offre
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
