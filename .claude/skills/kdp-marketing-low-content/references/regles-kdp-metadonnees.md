# Règles KDP sur les métadonnées (vérifiées le 14/10/2026)

Sources : aide KDP G201097560 (titre), G201298500 (mots-clés), G201189630 (description), G200652170 (catégories), GGE5T76TWKA85DJM (low-content), G200672390 (IA), G201834330 (redevances).

## Titre / sous-titre

- Moins de 200 caractères au total. Le titre doit correspondre exactement à la couverture.
- Interdits :
  - mots génériques répétés (notebook, journal, gifts, carnet, cadeau) ;
  - marques sans autorisation ;
  - titres ou auteurs tiers (« dans le style de… ») ;
  - « bestselling », « free », « gratuit » ;
  - HTML ;
  - mentions de remplissage (« n/a », « inconnu »).

## Mots-clés : 7 cases, 50 caractères chacune

Interdits :
- répéter le titre, le sous-titre, l'auteur ou les catégories (inutile, déjà indexés) ;
- affirmations subjectives : best, meilleur, top, parfait, incroyable ;
- termes temporaires : new, nouveau, promo, soldes, on sale ;
- mots génériques : book, livre ;
- **fautes d'orthographe**, et variantes d'espacement, de pluriel ou de ponctuation ;
- **noms d'auteurs** sans rapport, **marques** non détenues ;
- **guillemets** ;
- noms de programmes Amazon : Kindle Unlimited, KDP Select, Prime ;
- HTML.

KDP annonce une **tolérance zéro** pour les métadonnées trompeuses (risque de retrait du titre, voire du compte).

## Description

- Moins de 4 000 caractères, **balises comprises**.
- Balises acceptées : `<br> <p> <b> <em> <i> <u> <h4> <h5> <h6> <ol> <ul> <li>`. Aucune autre : ni h1-h3, ni strong, ni span, ni a.
- Interdits :
  - coordonnées, URL, e-mails ;
  - avis, citations de clients, témoignages, demandes d'avis ;
  - prix, promotions, disponibilité, informations temporaires ;
  - emoji ;
  - bourrage de mots-clés.

## Low-content

- Case à cocher sous « Catégories ». Si elle n'est pas cochée pour un livre à contenu minimal, le livre est refusé.
- ISBN : le vôtre ou aucun ; pas d'ISBN KDP gratuit ; ce choix est verrouillé après publication.
- Pas de distribution étendue, pas de série, pas de précommande ni de date de sortie.
- Sans ISBN : pas de Look Inside (« Feuilleter »), pas de vignette de 4e de couverture.

## IA

À déclarer : texte, images (couverture et intérieur) et traductions **générés** par IA, même retouchés. Pas de déclaration pour le contenu **assisté** (vous créez, l'IA corrige ou suggère).

## Volume de publication

- **Création** : environ 2 nouveaux titres par format et par semaine, plus une limite équivalente à la soumission.
- Comptage séparé pour l'ebook, le broché et le rigide ; remise à zéro le dimanche à 0 h UTC.
- Source non officielle (communauté KDP, septembre-octobre 2026) : **à revérifier**.

## Listes utilisées par l'application (`shared/src/marketing/rules.ts`)

- `TRADEMARKS` (erreur), `MAYBE_TRADEMARKS` (avertissement), `AUTHOR_NAMES` (erreur), `AMAZON_PROGRAMS` (erreur) ;
- `SUBJECTIVE`, `TIME_SENSITIVE`, `GENERIC_WORDS`, `TITLE_GENERIC`, `MISLEADING_FORMAT` ;
- `KNOWN_TYPOS` (fautes relevées dans les fichiers d'idées, avec correction) ;
- heuristique : un mot avec un « q » non suivi de « u » (journql, stupefiqnt) est signalé comme faute probable.

Ajoute à ces listes toute nouvelle marque ou tout nouvel auteur découvert dans une niche.
