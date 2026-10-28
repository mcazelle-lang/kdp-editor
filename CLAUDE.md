# CLAUDE.md — Book Creator (low-content KDP)

Application de création de carnets low-content pour Amazon KDP. Angular 20 (client) + Node/Express 5 (server) + logique partagée TypeScript (shared). Interface et contenus en **français**.

## Skills du projet

- `kdp-mise-en-page` : specs d'impression KDP, modèles de pages, couvertures.
- `kdp-marketing-low-content` : niches, fiches produit, mots-clés, conformité, audit des idées.

Charge-les dès qu'une tâche touche à l'intérieur, à la couverture ou à la fiche KDP.

## Commandes

```bash
npm run dev            # API :3000 + Angular :4200 (proxy /api /uploads /fonts)
npm test               # tests node:test via tsx (shared/test + server/test)
npm run typecheck      # tsc sur server + shared
npm run build          # build Angular (servi ensuite par `npm start`)
npm run import:ideas   # (ré)importe les .xlsx de la racine
npm run samples -- <dossier> [--guides]   # PDF d'exemple pour tous les préréglages
npm run deploy:hosting # build + publication de l'interface sur Firebase Hosting (kdp-creator-studio)
```

## Architecture

- `shared/src` est consommé **en source**, via l'alias `@shared` (tsconfig paths côté client et serveur). Pas d'étape de build. `shared/package.json` déclare `"type": "module"`, indispensable pour tsx.
- **Primitives graphiques** (`prims.ts`, en points PDF, origine en haut à gauche) produites une seule fois :
  - côté navigateur, rendues en SVG par `render/svg.ts` ;
  - côté serveur, rendues en PDF par `server/src/pdf/render.ts`.

  Toute nouvelle primitive doit être gérée dans les deux.
- Les règles KDP vivent dans `shared/src/kdp/specs.ts` et `pricing.ts`, datées par `SPECS_CHECKED_ON`. Ne code jamais une valeur KDP en dur ailleurs.
- Stockage : `server/data/db.json` (books, ideas, assets) et `server/data/uploads/`.
- Configuration : `server/.env` (modèle dans `server/.env.example`), chargé par `config.ts`. Variables :
  - `ANTHROPIC_API_KEY`, `AGENT_MODEL`, `AGENT_EFFORT`, `AGENT_MAX_ITERATIONS` ;
  - `GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL` ;
  - `CORS_ORIGINS`, `BOOK_CREATOR_DATA`, `BOOK_CREATOR_IDEAS`, `PORT`.
- **Assistant IA** (`server/src/agent/`) :
  - Tool runner bêta du SDK Anthropic en streaming. Outils `betaZodTool` (validés par Zod, `eager_input_streaming`) qui modifient une copie du livre.
  - Le contrat d'événements SSE est dans `shared/src/agent.ts`.
  - Le prompt système (`prompt.ts`) est figé pour le cache : n'y mets ni date ni donnée variable. Il duplique les règles KDP clés : mets-le à jour avec `specs.ts` et les skills.
  - Les tests rejouent l'API avec un faux `fetch` (`server/test/agent.test.ts`).
- **Niches** :
  - `shared/src/niches/` contient les marchés, le modèle, le parseur des captures (texte visible, 5 langues) et le score.
  - `server/src/niches/` contient l'autocomplétion (espacée et mise en cache), le stockage `db.data.niches`, les routes `/api/niches` et l'agent (découverte et analyse, avec `web_search`).
  - Toute l'analyse se fait dans `parse.ts` : si Amazon change ses pages, corrige `parse.ts` et ses tests, pas le favori.
  - Pas de robot qui télécharge des pages Amazon.
- **Favori** (`client/src/app/core/favori.ts`) : une fonction TS sérialisée par `toString()` dans `bookmarklet.ts`, partagée par les niches et le compte KDP.
  - Elle doit rester autonome : aucune variable extérieure, et pas de décomposition d'objet `{ ...x }` (le build la remplace par des fonctions utilitaires extérieures ; utilise `Object.assign`). Un test le vérifie.
  - Elle relaie ses données via l'onglet `/capture` de l'app (`postMessage`, origines vérifiées).
- **Compte KDP** (pas d'API KDP : jamais de connexion au compte, jamais de mot de passe ; c'est la personne qui clique « Publier ») :
  - `shared/src/kdp-account/` : modèle, parseur de la Bibliothèque et des Rapports (`parse.ts`), analyses de ventes, paquet de remplissage (`publish.ts`).
  - Rapports `.xlsx` exportés de KDP : `royalty-report.ts` (feuilles par format, en-têtes FR/EN, un instantané par mois `month`), `import-book.ts` (livre « publié » avec `book.kdp.url`), lecture exceljs et import dans `server/src/kdp/reports.ts` (`/api/kdp/reports`, `/reports/import-local` sur les `KDP_*.xlsx` du dossier des idées).
  - Conseils : `advice.ts` (prix et marge sur le coût d'impression réel, tendance, saison, variantes, fiche, diagnostic du catalogue) et `themes.ts` (pistes par niche). Aucun chiffre de marché supposé : tout chiffre vient des rapports. Les règles « livre publié » (72 h, nouvelle édition) sont dans `PUBLISHED_PRINT_EDITS` (`specs.ts`).
  - `server/src/kdp/routes.ts` : `/api/kdp` (captures, rapports, liaison et import de titres, préparation de la publication), stockage `db.data.kdp`.
  - Les sélecteurs KDP n'ont pas été vérifiés sur le vrai site : corrige `parse.ts` (ou le remplissage dans `favori.ts`) à partir du texte brut conservé dans `db.data.kdp.captures`.
- **Illustrations** : modèles d'image Gemini via `ai.interactions.create` (`agent/images.ts`). Imagen est arrêté depuis le 17/08/2026.
- **Firebase** : Hosting seulement (`firebase.json`, projet `kdp-creator-studio`). L'interface hébergée appelle l'API locale via `client/src/app/core/api-base.ts`. Toute URL côté client passe par `apiUrl()`.
- Client :
  - composants standalone avec `ChangeDetectionStrategy.OnPush`, signals, zoneless ;
  - éditeur à état local `BookStore` (sauvegarde automatique avec un délai de 700 ms) ;
  - onglet initial via `?onglet=agent|format|interior|cover|listing|marketing` ; la session de l'assistant (`AgentSession`) vit au niveau de l'éditeur.

## Conventions

- **Code** : identifiants en anglais. Libellés d'interface et commentaires en français, peu nombreux.
- **Intérieurs KDP** : traits ≥ 0,75 pt, gris ≥ 10 %, texte ≥ 7 pt, pas d'opacité, polices toujours chargées via `useFont()`, jamais les polices standard de pdfkit.
- **Aléatoire** : seulement via `ctx.rng()`, qui est déterministe, pour que l'aperçu soit identique au PDF.
- **Nouveau modèle de page** :
  - ajouter un `TemplateDef` dans `TEMPLATES` ;
  - ajouter sa phrase dans `marketing/description.ts` ;
  - les tests le couvrent automatiquement.
- **Nouvelle règle marketing** : `shared/src/marketing/rules.ts` (listes) ou `lint.ts` (contrôles).
