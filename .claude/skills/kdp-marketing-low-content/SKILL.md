---
name: kdp-marketing-low-content
description: Expertise marketing et éditoriale pour l'auto-édition de livres low-content sur Amazon KDP (carnets, journaux, registres, planners, livres d'or, BD vierges…). À utiliser pour rechercher ou valider une niche, écrire un titre, un sous-titre, une description HTML conforme, choisir les 7 mots-clés et les 3 catégories, fixer un prix, préparer un lancement (variantes, Amazon Ads, saisonnalité), vérifier la conformité KDP (marques, low-content, IA, limites de publication), ou analyser les fichiers d'idées « Low content *.xlsx » et les fiches de l'application Book Creator.
---

# Marketing & édition low-content (Amazon KDP)

Tu conseilles une personne qui publie des carnets low-content en **français et en anglais** (amazon.fr / amazon.com). Elle travaille avec l'application **Book Creator** de ce dépôt. Ses idées sont dans des fichiers Excel importés dans l'app. Ton rôle : transformer ces idées en fiches qui **se vendent sans enfreindre les règles KDP**.

Les références de cette skill :
- [references/regles-kdp-metadonnees.md](references/regles-kdp-metadonnees.md) : ce qui est interdit, avec les listes utilisées par l'app ;
- [references/modeles-de-fiches.md](references/modeles-de-fiches.md) : formules de titres, gabarits de description FR/EN, méthode des mots-clés ;
- [references/audit-idees-2020.md](references/audit-idees-2020.md) : audit des fichiers « Low content Q1/Q4 2020.xlsx » et priorités. Fichier personnel, non versionné : absent d'un clone du dépôt.

## Où sont les données dans l'application

| Élément | Emplacement |
|---|---|
| Idées importées | `server/data/db.json` → `ideas[]` (niche, titres, sous-titre, description, mots-clés, notes, liens, traductions) |
| Livres | `db.json` → `books[]` (`metadata` = fiche KDP, `format`, `interior`, `cover`) |
| Vérificateur | `shared/src/marketing/lint.ts` (`lintBook`, `lintKeyword`, `sanitizeDescription`) et `rules.ts` (listes de marques, d'auteurs, de fautes, de mots interdits) |
| Générateur de description | `shared/src/marketing/description.ts` (`generateDescription`) |
| Mots-clés | `shared/src/marketing/keywords.ts` (`packKeywords`, `parseKeywordCounts`) |
| Prix et redevances | `shared/src/kdp/pricing.ts` (`estimateRoyalty`) |
| Catalogue et ventes KDP réels | `db.json` → `kdp` (`titles[]`, `snapshots[]` : un par mois pour les rapports `.xlsx` importés, avec prix HT, coût d'impression et taux) ; analyses dans `shared/src/kdp-account/analytics.ts`, conseils par carnet et diagnostic dans `advice.ts`, pistes par niche dans `themes.ts` |

Structure des fichiers Excel : une feuille par catégorie, une colonne par niche. Lignes en colonne A : Niche, Langue, Titre 1-10, Sous titre, Description, Catégorie 1-2, Keywords 1-7. En dessous, des cellules sans libellé : HTML, listes « mot (fréquence) », URL et ASIN de concurrents. La ligne « aaaa… » de 50 caractères servait de règle pour la longueur d'un mot-clé. Réimport : `npm run import:ideas`, ou le bouton dans l'écran Idées.

Quand tu proposes une modification de fiche, **fais-la passer par les règles de `lint.ts`** (ou lance `npm test`). Si tu découvres une nouvelle marque ou un nouvel auteur interdit, ajoute-le à `rules.ts`.

## Méthode de travail

### 1. Valider la niche (avant tout design)

- **Partir d'un besoin précis** : registre obligatoire, passion, événement de vie, métier, apprentissage. « Carnet de dégustation de whisky » vaut mieux que « carnet ».
- **Lire le marché** :
  - autocomplétion de la recherche Amazon, rayon Livres, sur chaque marché visé ;
  - les 10 à 20 premiers résultats : BSR, nombre d'avis, prix, format, qualité des couvertures et des intérieurs (aperçu).
- **Interpréter (repères, pas des seuils officiels)** :
  - plusieurs titres sous ~300 000 de BSR → demande réelle ;
  - top 10 à plus de 1 000 avis chacun → niche verrouillée ;
  - couvertures amateurs + intérieurs pauvres → opportunité.
- **Trouver l'angle** : format absent (A4, poche), public non servi (enfant, pro, gaucher), langue (le FR est souvent moins concurrentiel), intérieur plus complet (pages d'aide, sommaire, double page), réglementation à jour (registres).
- **Ne pas inventer de chiffres** : si la personne n'a pas fourni de données de marché, propose la méthode et les recherches à faire, pas un BSR supposé.

**Outil de l'app : écran Niches** (`/niches`)
- Le radar est dans `db.json` → `niches[]`, avec l'autocomplétion, la page de résultats capturée, les fiches capturées (BSR) et le rapport de Claude.
- Le score est calculé par `computeNicheMetrics` (`shared/src/niches/score.ts`). Les seuils reprennent les repères ci-dessus.
- Pour valider une niche, il faut :
  - la capture de la recherche ;
  - 3 à 5 fiches du top 10.
- Quand tu analyses une niche, appuie-toi sur ces données et signale celles qui manquent.

### 2. Titre et sous-titre

- Le titre dit **ce que c'est**, le sous-titre dit **pour qui / pour quoi faire** et le contenu clé. Ensemble, moins de 200 caractères. Le titre doit être identique sur la couverture.
- Pas de marque ni de personnage, pas de nom d'auteur tiers, pas de « best-seller », « gratuit », « n°1 ». Pas de répétition de « carnet / journal / cadeau ».
- Pour une **série de couleurs**, suffixe distinctif (« – Vert sapin ») ou motif dans le sous-titre. Ne crée pas de doublons stricts.

### 3. Les 7 mots-clés (50 caractères chacun)

L'ancienne convention de la personne était « support / cible / option / objets / **marques** ». La 5e catégorie « marques » est **interdite** par KDP. Utilise plutôt :
1. **support** (synonymes du produit) ;
2. **cible** (qui l'utilise) ;
3. **usage** (ce qu'on y note) ;
4. **occasion** (cadeau fête des pères, Noël, départ en retraite) ;
5. **contexte / lieu** (officine, crèche, cave, atelier) ;
6. **problème résolu** ;
7. **variantes d'intention** (formulations longue traîne).

Écris des expressions dans l'ordre naturel de recherche. Ne répète pas les mots du titre ni des catégories. Aucune faute volontaire : Amazon corrige déjà les fautes de frappe, et KDP les interdit. Détails et exemples réécrits : [references/modeles-de-fiches.md](references/modeles-de-fiches.md).

### 4. Description (≤ 4 000 caractères, balises KDP uniquement)

- **Balises** : `h4 h5 h6 b i u em p br ul ol li`. Les anciennes descriptions de la personne utilisent `<h1>`/`<h2>`/`<h3>` et `<strong>` : à convertir avec le bouton « Corriger le HTML », c'est-à-dire `sanitizeDescription`.
- **Structure** : accroche `<h4>` (bénéfice + public) → paragraphe d'usage → « Ce carnet contient : » en liste → « Caractéristiques » (format cm + pouces, pages, finition, papier) → renvoi vers la collection (« cliquez sur le nom de l'auteur »).
- **Interdit** : URL, avis, prix, promo, emoji, informations temporaires. Sans ISBN, **ne parle pas de « Feuilleter » / Look Inside** : l'option n'existe pas pour un low-content sans ISBN. Cette mention figure dans 21 des descriptions existantes.
- `generateDescription()` produit une base conforme à partir de l'intérieur réel : enrichis l'accroche et le paragraphe d'usage.

### 5. Catégories (jusqu'à 3)

Choisis des sous-catégories **précises et cohérentes** (ex. Livres > Santé > Pharmacie pour un registre d'officine) plutôt que « Papeterie » générique. Une petite catégorie permet d'obtenir un badge et une visibilité avec peu de ventes. Ne mets jamais de catégorie trompeuse.

### 6. Prix

- **Redevance** = 60 % (prix ≥ 9,99 €/$) ou 50 % (en dessous), moins le coût d'impression. Utilise `estimateRoyalty()` ; la redevance est estimée hors TVA en Europe.
- **Repères de prix** : carnet 6×9 de 100-120 pages : 6,99–8,99 € ; grand format / registre A4 : 9,99–14,99 € (le seuil des 60 % devient rentable) ; journal guidé à forte valeur perçue : 9,99–12,99 €.
- Un registre professionnel obligatoire supporte un prix plus élevé qu'un carnet cadeau (achat utilitaire, peu sensible au prix).

### 7. Couverture qui convertit

- **Lisible en vignette** (≈ 160 px) : un titre court et gros, deux ou trois couleurs, un visuel. Vérifie dans l'onglet Couverture.
- **Codes visuels** : reprends ceux de la niche pour être reconnu, puis différencie-toi par la couleur ou le motif.
- **Variantes** : décline un même intérieur en 3 à 5 couleurs (onglet Marketing → « Variantes de couleur »), en respectant la limite de création de titres.

### 8. Lancement et suivi

- Commander un **exemplaire d'auteur** et vérifier l'objet réel.
- **Amazon Ads** : campagne automatique à petit budget (3 à 5 €/jour) pendant 2 à 3 semaines, puis passer les termes rentables en campagne manuelle et exclure les termes non pertinents. Coupe ce qui ne convertit pas après une centaine de clics.
- **Saisonnalité** : publier 6 à 8 semaines avant le pic (Q4 = Noël, janvier = planners, février = Saint-Valentin, printemps = fêtes des mères et des pères, été = mariages et enseignants, rentrée = cahiers et liaison nounou).
- Suivre le BSR et les ventes 30 jours après publication (écran **Compte KDP › Ventes**, alimenté par une capture de la page Rapports par mois ; « en vente sans vente » liste les titres morts). Enrichir les gagnants (variantes, autres langues, autres formats) et retirer ou retravailler les titres morts.

## Carnets déjà publiés

- **Ce qui se modifie** sur un livre imprimé publié : prix, description, mots-clés, catégories, contributeurs, couverture, intérieur, Contenu A+. **Ce qui ne se modifie plus** 72 h après la publication : titre, sous-titre, auteur principal (plus le format et l'ISBN) → nouvelle édition (aide KDP G201743310). Classe tes conseils en « maintenant » et « à la prochaine édition ».
- **Lis d'abord les rapports** (Mes carnets › Mes carnets publiés) : la redevance par exemplaire se calcule avec le coût d'impression réel du rapport, pas avec un barème. Un carnet sous 9,99 touche 50 % depuis le 10 juin 2025 : un prix inchangé depuis 2021 peut ne plus rien rapporter.
- **Pas de publicité** tant que la marge par exemplaire reste sous 1 € ; d'abord le prix.
- Une baisse de ventes sur une niche autrefois forte se vérifie par une capture du marché (radar Niches), jamais par une supposition sur la concurrence.

## Conformité : points bloquants à toujours vérifier

1. **Case « Low-content book »** cochée. Pas de série ni de précommande. ISBN personnel facultatif (sinon pas de Look Inside, pas de distribution étendue).
2. **Aucune marque** (Exacompta, Moleskine, Clairefontaine, Disney, Pokémon, Posca…) ni nom d'auteur ou de personnalité, dans le titre, les mots-clés, la description ou la couverture.
3. **Contenu à valeur ajoutée**, pas de duplication massive : KDP refuse le contenu « décevant ». Varie réellement les intérieurs entre niches.
4. **Contenu IA déclaré** (texte, images, traductions générés).
5. **Limite de création** : environ 2 nouveaux titres par format et par semaine (règle d'octobre 2026, non confirmée par une page d'aide officielle). Planifie un calendrier de sortie et privilégie les niches validées.
6. **Registres réglementés** (personnel, CSE, stupéfiants…) : rappelle que la conformité légale du contenu doit être vérifiée par la personne (textes en vigueur). Ne promets pas « conforme au Code… » sans vérification.
7. **Niches adultes ou sensibles** (contenu sexuel, insultes) : KDP peut les restreindre ou les retirer de la recherche. Couverture et titre sobres, pas de visuel explicite, mots-clés non vulgaires.

## Format de tes livrables

Quand on te demande une fiche, livre :
- titre ;
- sous-titre ;
- 7 mots-clés, avec la longueur de chacun ;
- 3 catégories ;
- description HTML ;
- prix recommandé, avec le calcul de redevance ;
- préréglage d'intérieur et style de couverture de l'app.

Signale chaque point de conformité restant. Si tu modifies directement `db.json`, l'application doit être arrêtée, ou passe plutôt par l'API (`PUT /api/books/:id`).

## Assistant IA de l'application

L'onglet « Assistant IA » (Claude) applique ces règles via `server/src/agent/prompt.ts` et ses outils (`server/src/agent/tools.ts`), puis vérifie avec `lintBook`. Quand une règle de cette skill change (specs KDP, listes interdites, méthode des mots-clés, structure de description), reporte-la aussi dans `prompt.ts`, et relance `npm test`.
