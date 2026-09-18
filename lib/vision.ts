/**
 * Identification produit à partir d'une image via Google Cloud Vision
 * (Web Detection). Free tier: 1000 unités/mois.
 * https://cloud.google.com/vision/pricing
 */

interface VisionWebDetectionResponse {
  responses: {
    webDetection?: {
      bestGuessLabels?: { label: string }[];
      webEntities?: { description?: string; score?: number }[];
    };
  }[];
}

export async function identifyProductKeywords(
  imageBase64: string
): Promise<string[]> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_VISION_API_KEY manquante. Voir .env.example pour la configuration."
    );
  }

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBase64 },
            features: [{ type: "WEB_DETECTION", maxResults: 10 }],
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Google Vision API error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as VisionWebDetectionResponse;
  const detection = data.responses?.[0]?.webDetection;

  const keywords: string[] = [];

  if (detection?.bestGuessLabels) {
    keywords.push(...detection.bestGuessLabels.map((l) => l.label));
  }

  if (detection?.webEntities) {
    const entityLabels = detection.webEntities
      .filter((e) => e.description && (e.score ?? 0) > 0.5)
      .map((e) => e.description as string);
    keywords.push(...entityLabels);
  }

  // Dédoublonnage, garde les 5 mots-clés les plus pertinents
  return Array.from(new Set(keywords)).slice(0, 5);
}
