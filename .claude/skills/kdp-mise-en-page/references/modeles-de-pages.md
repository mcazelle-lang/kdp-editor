# Catalogue des modèles de pages et réglures

## Modèles disponibles (`shared/src/interior/templates.ts`)

| id | Nom | Paramètres clés | Usages |
|---|---|---|---|
| `title-page` | Ce carnet appartient à | titre, lignes (séparées par ;), cadre, police | ouverture de tout carnet |
| `blank` | Vierge | cadre, texte centré discret | sketchbook, livre d'or, spécimen d'herbier, photos |
| `lined` | Ligné | interligne mm, en-tête, marge, numérotation | journal, notes, code |
| `dotted` | Pointillé | espacement, diamètre | bullet journal |
| `grid` | Quadrillé | carreau, trait renforcé tous les N | plans, maths, broderie |
| `seyes` | Seyès | 2 / 2,5 / 3 mm, marge | cahiers FR, musique scolaire |
| `handwriting` | Écriture primaire | cadre de dessin, hauteur de ligne | composition K-2, cahier d'écriture |
| `music` | Portées | nombre, interligne, ligne de paroles | partitions, chansons |
| `tablature` | Tablature | nombre, écart des cordes, diagrammes d'accords | guitare |
| `comic` | Planche de BD | disposition (variée / fixe), gouttière, contour | BD vierge, manga, storyboard |
| `coupons` | Bons à découper | intitulé, bons par colonne, 1-2 colonnes, lignes du bas, numérotation | bons pour amoureux, chèques cadeaux |
| `table` | Tableau / registre | titre, champs d'en-tête, colonnes, lignes, libellés de lignes (`rowLabels`), zébrage, report/total | inventaire, caisse, comptes, suivi bébé, rendez-vous, score de golf |
| `form` | Fiche | champs (ligne, lignes, cadre, note ★, cases), 1-4 par page, onglet A-Z | mots de passe, recettes, dégustation, salarié, herbier |
| `checklist` | Checklist | numérotation continue, max, 1-2 colonnes | bucket list, préparation, courses |
| `weekly` | Semainier | bandes / grille, lignes, notes | liaison nounou, planner |
| `monthly` | Mensuel | notes | budget, agenda perpétuel |

**Jetons de texte** : `{n}` (page dans la section), `{page}` (numéro global), `{letter}` (lettre A-Z répartie sur la section).

**Double page** : `section.alt` applique un autre modèle aux pages de gauche (versos).

## Réglures de référence

| Réglure | Valeur | Remarque |
|---|---|---|
| College ruled (US) | 7,1 mm (9/32 in) | standard des notebooks 6×9 |
| Wide ruled | 8,7 mm (11/32 in) | enfants, seniors |
| Narrow ruled | 6,35 mm (1/4 in) | code, prise de notes dense |
| Seyès | carreau 8 mm, interligne 2 mm | marge rouge à environ 4 cm (en N&B : trait plus foncé) |
| Seyès CP | 3 mm (carreau 12 mm) | apprentissage de l'écriture |
| Dot grid | 5 mm | points de 1,4 à 1,8 pt |
| Quadrillé | 5 mm (petits carreaux) | |
| Portée | interligne 1,8–2,2 mm | 10 à 12 portées en A4, 8 avec Seyès en vis-à-vis |
| Primaire (K-2) | rangée de 14–20 mm, médiane pointillée | trait de base plus foncé |

## Couleurs en noir & blanc

| Élément | Couleur | Gris |
|---|---|---|
| Lignes d'écriture | `#8a8a8a` | 46 % |
| Lignes secondaires (Seyès) | `#b4b4b4` | 29 % |
| En-tête de tableau | `#d0d0d0` | 18 % |
| Lignes alternées | `#e3e3e3` | 11 % |

Ne descends jamais sous 10 % de gris. L'app calcule `grayPercent()` et avertit.

## Préréglages par niche (`presets.ts`)

| Niche | Préréglage | Format conseillé |
|---|---|---|
| Carnet couleur tendance, citations | `notebook-lined` | 6×9 |
| Bullet journal | `bullet-journal` | 5,5×8,5 |
| Cahier, Seyès | `cahier-seyes` | A4 |
| Sketchbook, blackbook, tatouage | `sketchbook` | 8,5×11 |
| BD vierge, manga | `comic-blank` | 8,5×11 |
| Cahier de musique | `music-staff` / `music-seyes` | A4 |
| Guitare | `guitar-tab` | 8,5×11 |
| Livre d'inventaire | `inventory` | A4 |
| Livre de caisse | `cash-book` | A4 |
| Recettes / dépenses | `income-expense` | A4 |
| Budget planner, kakeibo | `budget-planner` | 6×9 |
| Mots de passe | `password-book` | 5,5×8,5 |
| Recettes de cuisine | `recipe-book` | 7,5×9,25 |
| Recettes DIY cosmétiques | `diy-recipes` | 7,5×9,25 |
| Dégustation whisky / vin / bière | `tasting-journal` | 6×9 |
| Reading log | `reading-log` | 6×9 |
| Registre du personnel | `staff-register` | A4 |
| Suivi bébé | `baby-log` | 7,5×9,25 |
| Liaison nounou | `nanny-liaison` | 5,5×8,5 |
| Bucket list | `bucket-list` | 7×10 |
| Herbier | `herbarium` | A4 |
| Écriture primaire | `primary-composition` | 7,5×9,25 |
| Programmation | `code-notebook` | 6×9 |
| Livre d'or | `guest-book` | 8,25×8,25 |
| Survivalisme | `checklists-survival` | 5,5×8,5 |
| Gun inventory (US) | `gun-inventory` | 6×9 |
| Registre des stupéfiants | `drug-register` | A4 |
| Registre du CSE | `cse-register` | A4 |
| Bons pour amoureux | `love-coupons` | 6×9 |
| Mes premières fois | `baby-firsts` | 8,5×11 |
| Carnet de rendez-vous | `appointment-book` | 8,5×11 |

Registres réglementés (personnel, stupéfiants, CSE) : la mise en page est un point de départ, **le contenu légal doit être vérifié** (Code du travail, Code de la santé publique R5132-36…) avant publication.
