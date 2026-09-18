# Comparateur produit — MVP (AliExpress + BigBuy)

Colle une image (ou tape un texte) et retrouve le produit avec un prix total
estimé (produit + port + douane probable) comparé entre AliExpress et BigBuy.

## État actuel

- **AliExpress**: intégration via une API tierce non-officielle (RapidAPI),
  choisie volontairement pour éviter la vérification d'identité (passeport/CNI)
  exigée par le programme AliExpress Affiliate officiel.
- **BigBuy**: adaptateur prêt à l'emploi mais avec **données mockées** —
  l'API officielle BigBuy nécessite le Pack E-commerce payant (89€/mois).
  Renseigner `BIGBUY_API_KEY` dans `.env.local` active l'appel réel.
- **Identification image**: Google Cloud Vision (Web Detection), gratuit
  jusqu'à 1000 requêtes/mois.

## Configuration

```bash
cp .env.example .env.local
```

Puis renseigner:
- `GOOGLE_VISION_API_KEY` — https://console.cloud.google.com/apis/credentials
- `RAPIDAPI_KEY` + `RAPIDAPI_ALIEXPRESS_HOST` — choisir une API AliExpress
  avec tier gratuit sur https://rapidapi.com/collection/aliexpress-api
- `BIGBUY_API_KEY` — optionnel, laisser vide pour rester en mode mocké

## Lancer en local

```bash
npm run dev
```

Ouvrir http://localhost:3000. Pour tester sans consommer le quota Vision API,
utiliser le champ de recherche texte plutôt que l'upload d'image.

## Structure

- `lib/vision.ts` — identification produit par image (Google Vision)
- `lib/aliexpress.ts` — recherche AliExpress (API tierce RapidAPI)
- `lib/bigbuy.ts` — recherche BigBuy (mocké tant que le pack payant n'est pas activé)
- `lib/pricing.ts` — calcul du prix total estimé (TVA/douane FR/UE 2026)
- `app/api/search/route.ts` — orchestration: image → mots-clés → recherche multi-fournisseurs → tri par prix total
- `app/page.tsx` — UI de recherche et résultats

## Prochaines étapes possibles

- Ajouter CJdropshipping (API officielle gratuite, entrepôts UE) comme
  troisième source pour renforcer la couverture Europe
- Cache Redis pour éviter de repayer une identification d'image déjà vue
- Matching/déduplication d'un même produit entre plusieurs offres
