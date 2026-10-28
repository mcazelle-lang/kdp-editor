# Spécifications Amazon KDP — broché, rigide, métadonnées, coûts

Relevé le **14/10/2026** sur les pages d'aide officielles de kdp.amazon.com. Les pages ne portent pas de date de mise à jour. Les points marqués **[non confirmé]** n'ont pas pu être vérifiés sur une page officielle. Revérifie avant de t'appuyer dessus, et reporte tout changement dans `shared/src/kdp/specs.ts` et `pricing.ts`.

Sources (préfixe `https://kdp.amazon.com/en_US/help/topic/`) :
- formats, fond perdu et marges : GVBQ3CMEQW3W2VL6 ;
- consignes de soumission : G201857950 ;
- couverture : G201953020 ;
- codes-barres : G5HDYGP4BXLX4RUW ;
- rigide : GAVW3FZZAKA2KY3B, GDTKFJPNQCBTMRV6, GHT976ZKSKUXBB6H ;
- métadonnées : G201097560, G201298500, G201189630, G200652170, GGE5T76TWKA85DJM, G202172740, G200672390 ;
- redevances et impression : G201834330, G201834340.

## 1. Broché (paperback)

### Formats de coupe et nombre de pages

Pages par encre : N&B blanc / N&B crème / N&B groundwood / couleur standard / couleur premium.

| Format (in / cm) | Classe | Pages |
|---|---|---|
| 5×8 (12,7×20,32), 5,06×7,81, 5,25×8, 5,5×8,5 (13,97×21,59), 6×9 (15,24×22,86) | standard | 24–828 / 24–776 / 24–812 / 72–600 / 24–828 |
| 6,14×9,21, 6,69×9,61, 7×10 (17,78×25,4), 7,44×9,69, 7,5×9,25 (19,05×23,5), 8×10 | grand | mêmes plages |
| 8,25×6, 8,25×8,25 | grand | 24–800 / 24–750 / 24–784 / 72–600 / 24–800 |
| 8,5×8,5, 8,5×11 (21,59×27,94) | grand | 24–590 / 24–550 / 24–578 / 72–600 / 24–590 |
| A4 8,27×11,69 (21×29,7) | grand | 24–780 / 24–730 / 24–764 / indisponible / 24–590 |

- **Grand format** : largeur > 6,12 in ou hauteur > 9 in (coût d'impression plus élevé).
- **Arrondi** : KDP arrondit le nombre de pages au pair supérieur.

### Épaisseur du dos (par page)

| Papier / encre | Épaisseur |
|---|---|
| N&B blanc | 0,002252 in |
| N&B crème | 0,0025 in |
| groundwood | 0,00235 in |
| couleur standard | 0,002252 in |
| couleur premium | 0,002347 in |

### Couverture

- **Dimensions** : largeur = 0,125 + 4e + dos + 1re + 0,125 ; hauteur = coupe + 0,25.
- **Texte** : au moins 0,125 in à l'intérieur de la coupe (les consignes disent 0,25 in du bord extérieur, ce qui revient au même). Les bordures fines sont déconseillées, à cause d'une tolérance de coupe de 0,125 in.
- **Dos** : texte seulement au-delà de 79 pages (80 pages ou plus ; Cover Creator exige 80). Marge de 0,0625 in de chaque côté, plus 0,0625 in de tolérance de pliure.
- **Code-barres** :
  - KDP le place dans un cadre blanc en bas à droite de la 4e de couverture ;
  - code-barres fourni par l'éditeur : 2 × 1,2 in conseillé (minimum 1,4 × 0,8), à 0,25 in ou plus du dos et de la coupe, sur fond blanc uni ;
  - **[non confirmé]** pas de décalage exact publié pour le broché ; le rigide indique ≥ 0,76 in du bas.
- **Fichier** : images ≥ 300 DPI, PDF aplati, texte ≥ 7 pt, PDF unique ≤ 650 Mo (40 Mo ou moins conseillé).

### Intérieur

- **Page avec fond perdu** = (coupe + 0,125) × (coupe + 0,25) in. Exemples : 6×9 → 6,125×9,25 ; 8,5×11 → 8,625×11,25. Un fichier à fond perdu doit être un PDF.
- **Marge intérieure minimale** :

  | Pages | Minimum |
  |---|---|
  | 24–150 | 0,375 in |
  | 151–300 | 0,5 in |
  | 301–500 | 0,625 in |
  | 501–700 | 0,75 in |
  | 701–828 | 0,875 in |

- **Marges extérieures, haute et basse** : ≥ 0,25 in sans fond perdu, ≥ 0,375 in avec.
- **Contenu** :
  - polices embarquées, texte ≥ 7 pt ;
  - traits ≥ 0,75 pt (0,01 in), aplats gris ≥ 10 % ;
  - images ≥ 300 DPI, transparence aplatie ;
  - pages simples (pas de planches), sans traits de coupe, annotations ni chiffrement.

## 2. Relié rigide (case laminate)

- **Formats** : 5,5×8,5 et 6×9 (standard) ; 6,14×9,21, 7×10 et 8,25×11 (grand). Page à fond perdu 8,25×11 → 8,375×11,25.
- **Pages** : 75–550 (le calculateur impose 76–550). Papier N&B blanc, N&B crème ou couleur premium.
- **Restrictions** : pas sur .co.jp, pas de distribution étendue. Tranchefiles au-delà de 120 pages.
- **Couverture** :
  - rabat de 0,51 in sur chaque bord, charnière de 0,4 in de chaque côté du dos ;
  - zone de sécurité à 0,635 in du bord ;
  - code-barres 2 × 1,2 in en bas à droite, ≥ 0,76 in du bas et ≥ 0,25 in de la charnière.
- **Épaisseur du dos [non confirmé]** : aucune formule officielle, et les formules tierces se contredisent. **Prendre les dimensions du calculateur KDP** (https://kdp.amazon.com/cover-calculator) et les saisir dans l'onglet Format.

## 3. Métadonnées

- **Titre + sous-titre** : moins de 200 caractères. Le titre doit correspondre à la couverture. Interdits :
  - mots génériques répétés (notebook, journal, gifts) ;
  - marques et titres ou auteurs tiers ;
  - « bestselling », « free » ;
  - HTML, ou textes de remplissage du type « n/a ».
- **Mots-clés** : 7 cases ; 50 caractères par case, imposés par le formulaire **[non écrit dans l'aide]**. Interdits :
  - répétition des autres métadonnées et des catégories ;
  - affirmations subjectives (« best ») et termes temporaires (« new », « on sale ») ;
  - mots génériques (« book ») ;
  - fautes d'orthographe et variantes d'espacement, de pluriel ou de ponctuation ;
  - auteurs sans rapport, marques non détenues ;
  - guillemets, noms de programmes Amazon (Kindle Unlimited, KDP Select), HTML.

  KDP applique une « tolérance zéro » aux métadonnées trompeuses.
- **Description** : 4 000 caractères, balises comprises. Balises acceptées : `<br> <p> <b> <em> <i> <u> <h4> <h5> <h6> <ol> <ul> <li>`, donc **pas** de h1-h3 ni de strong. Interdits : coordonnées et URL, avis et témoignages, demandes d'avis, prix et disponibilité, informations temporaires, emoji, bourrage de mots-clés.
- **Catégories** : jusqu'à 3.
- **Case « Low-content book »** (sous Catégories ; l'oublier entraîne un refus) :
  - ISBN personnel ou aucun ; pas d'ISBN KDP gratuit ; choix verrouillé après publication ;
  - pas de distribution étendue, pas de série, pas de date de sortie ni de précommande ;
  - sans ISBN : pas de Look Inside, pas de vignette de 4e de couverture (contournable avec son propre ISBN ou du contenu A+) ;
  - code-barres placé automatiquement en bas à droite de la 4e.
- **Limite de titres** : environ 2 nouveaux titres par format et par semaine à la création, et 2 à la soumission. Comptage par format (ebook, broché, rigide), remise à zéro le dimanche à 0 h UTC. **[dates non confirmées : annonces communautaires de septembre et octobre 2026]**
- **IA** : déclarer le texte, les images (couverture et intérieur) et les traductions générés par IA, même retouchés. Le contenu « assisté » (créé par vous, l'IA n'ayant servi qu'à corriger ou à trouver des idées) n'est pas concerné.

## 4. Redevances et coûts d'impression (broché)

- **Redevance** :
  - 60 % pour un prix ≥ 9,99 $ / 9,99 € / 7,99 £, 50 % en dessous (depuis le 10 juin 2025) ;
  - distribution étendue : 40 % ;
  - redevance = taux × prix − impression ; prix minimum = impression ÷ taux ; prix maximum 250 $/€.
  - Base hors TVA en Europe **[non confirmé]**.
- **Impression** = fixe + pages × coût par page. Barème sans date sur la page officielle ; exemple officiel : 300 pages N&B = 4,60 $.

| Encre | Pages | USD standard | USD grand | EUR standard | EUR grand |
|---|---|---|---|---|---|
| N&B blanc/crème | 24–108 | 2,30 forfait | 2,84 | 2,05 | 2,48 |
| N&B blanc/crème | 110–828 | 1,00 + 0,012/p | 1,00 + 0,017/p | 0,75 + 0,012/p | 0,75 + 0,016/p |
| N&B groundwood | 24–112 | 2,23 forfait | 2,75 | 1,98 | 2,39 |
| N&B groundwood | 114–828 | 1,00 + 0,0114/p | 1,00 + 0,0162/p | 0,75 + 0,0114/p | 0,75 + 0,0152/p |
| Couleur standard | 72–600 | 1,00 + 0,0255/p | 1,00 + 0,0402/p | 0,75 + 0,024/p | 0,75 + 0,035/p |
| Couleur premium | 24–40 | 3,60 forfait | 4,20 | 2,85 | 3,61 |
| Couleur premium | 42–828 | 1,00 + 0,065/p | 1,00 + 0,08/p | 0,75 + 0,0525/p | 0,75 + 0,0715/p |
