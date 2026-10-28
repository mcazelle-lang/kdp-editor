---
name: kdp-mise-en-page
description: Expertise de mise en page pour les livres low-content Amazon KDP (carnets, journaux, registres, planners, cahiers de musique, BD vierges…). À utiliser pour concevoir ou vérifier un intérieur ou une couverture (formats de coupe, fond perdu, marges, épaisseur du dos, zone code-barres, polices, épaisseur des traits), choisir une réglure (ligné, Seyès, pointillés, portées…), ajouter un modèle de page ou un style de couverture dans l'application Book Creator, ou contrôler un PDF avant téléversement sur KDP.
---

# Mise en page KDP low-content

Tu interviens sur l'application **Book Creator** (Angular + Node) qui génère des PDF prêts pour KDP. Toute la géométrie vient d'une source unique, partagée par l'aperçu navigateur et les PDF :

| Sujet | Fichier |
|---|---|
| Règles KDP (formats, pages, dos, marges, coûts) | `shared/src/kdp/specs.ts`, `shared/src/kdp/pricing.ts` |
| Géométrie page intérieure / couverture | `shared/src/kdp/geometry.ts` |
| Modèles de pages (16) | `shared/src/interior/templates.ts` (+ outils dans `kit.ts`) |
| Préréglages par niche (30) | `shared/src/interior/presets.ts` |
| Couverture : rendu, motifs, styles, palettes | `shared/src/cover/render.ts`, `patterns.ts`, `styles.ts` |
| Rendu PDF (pdfkit, polices embarquées) | `server/src/pdf/render.ts`, `documents.ts` |

Unités : **points PDF** (1/72 in), origine en haut à gauche. Utilise `inToPt`, `mmToPt`.

Les spécifications détaillées, vérifiées sur kdp.amazon.com le 14/10/2026, sont dans [references/kdp-specs.md](references/kdp-specs.md). Le catalogue des réglures et des modèles par niche est dans [references/modeles-de-pages.md](references/modeles-de-pages.md).

## Règles qui font refuser un fichier (à ne jamais enfreindre)

1. **Format de page PDF = format de coupe**, ou coupe + 0,125 in en largeur et + 0,25 in en hauteur avec fond perdu. Le fond perdu ne s'ajoute que sur le bord extérieur : à droite d'un recto, à gauche d'un verso.
2. **Marge intérieure (petit fond) minimale** selon le nombre de pages : 0,375 in jusqu'à 150 pages, puis 0,5 / 0,625 / 0,75 / 0,875 in. Marges extérieures ≥ 0,25 in sans fond perdu, ≥ 0,375 in avec. `interiorPageGeometry()` applique ces minimums automatiquement.
3. **Polices embarquées.** pdfkit n'embarque pas ses 14 polices standard (Helvetica…). Passe toujours par `useFont()`, qui charge les fichiers @fontsource. Le test `server/test/server.test.ts` vérifie l'absence de `/BaseFont /Helvetica`.
4. **Traits ≥ 0,75 pt, gris ≥ 10 %, texte ≥ 7 pt.** Une ligne gris clair à 0,5 pt disparaît à l'impression. Les helpers `hline` et `vline` forcent 0,75 pt minimum.
5. **Pas de transparence dans l'intérieur.** `paint()` n'écrit l'opacité que si elle est inférieure à 1. Sur la couverture, les motifs posés sur un fond uni sont « aplatis » par `flattenOpacity()`.
6. **Nombre de pages** : 24 minimum, maximum selon le format et le papier (`pageRange()`). KDP arrondit au nombre pair, d'où l'option `padToEven`.
7. **Couverture = un seul PDF** pour la 4e, le dos et la 1re. Dimensions :
   - largeur = 0,125 + coupe + dos + coupe + 0,125 in ;
   - hauteur = coupe + 0,25 in.

   Dos = pages × 0,002252 in (N&B blanc), 0,0025 (crème), 0,00235 (groundwood), 0,002252 (couleur standard), 0,002347 (couleur premium).
8. **Texte sur le dos** : à partir de 80 pages seulement, avec 0,0625 in de marge de chaque côté du dos.
9. **Zone code-barres** : 2 × 1,2 in en bas à droite de la 4e de couverture, à 0,25 in du dos et du bas. À laisser vide : KDP y imprime le code-barres, même sans ISBN.
10. **Rigide** : KDP ne publie pas de formule pour le dos. Fais saisir les dimensions du calculateur officiel (`format.coverSizeOverride`) ou importer son gabarit PNG en calque. Ne présente jamais l'estimation comme exacte.

## Choisir la réglure et le format (repères métier)

- **Carnet ligné** : 6 × 9 in (le plus vendu) ou 5,5 × 8,5 in. College ruled = 7,1 mm (9/32 in), wide = 8,7 mm, narrow = 6,35 mm. 100 à 120 pages.
- **France** : Seyès 8 mm / 2 mm avec marge (cahiers, musique scolaire). Registres en **A4** (8,27 × 11,69 in). Attention, l'A4 n'existe pas en couleur standard.
- **Bullet journal** : pointillés à 5 mm, points de 1,4 à 1,8 pt de diamètre.
- **Musique** : portées de 5 lignes, interligne 1,8 à 2,2 mm (portée d'environ 8 mm), 10 à 12 portées par page en A4.
- **BD vierge** : 8,5 × 11 in. Gouttière de 3 à 5 mm, contour de 1,5 pt. Des planches toutes différentes apportent une vraie valeur ajoutée (mode « variée », graine déterministe).
- **Registres et tableaux** : en-tête grisé (gris ≥ 15 %), lignes alternées (≥ 10 %), 25 à 30 lignes en A4, colonnes proportionnelles au contenu (Libellé ≈ 3× Date).
- **Fiches** (mots de passe, recettes, dégustation) : 1 à 4 par page. Champs en demi-largeur pour les données courtes. Onglet A-Z réparti sur la section.
- **Double page différenciée** (`section.alt`) : herbier (spécimen à gauche, fiche à droite), bucket list (récit / souvenirs), musique + Seyès.
- **Valeur ajoutée** : page « Ce carnet appartient à », sommaire, pages d'aide, notes finales. Un intérieur 100 % répétitif sans valeur est le premier motif de refus « contenu décevant ».

## Couverture : principes de design

- **Test de la vignette** (≈ 160 px de large) : titre lisible, une idée, deux ou trois couleurs. L'onglet Couverture affiche cette vignette.
- **Contraste** titre/fond ≥ 4,5:1 (l'app avertit sous 3:1).
- **Zone de sécurité** : texte à au moins 0,25 in de la coupe (recommandé ; minimum KDP 0,125 in). Rien d'important sur la charnière en rigide.
- **Codes de la niche** : un registre se veut sobre (cuir surpiqué, noir et or, cadre), un livre enfant coloré (confettis, médaillon, police ronde), un carnet bébé ou couple doux (pastel, script).
- **Correspondance** : le titre et l'auteur de la couverture doivent correspondre à la fiche KDP (contrôlé par `lintBook`).
- **Images** : PNG ou JPEG uniquement, à 300 DPI effectifs ou plus. Pour un fond pleine couverture : (largeur × 300) × (hauteur × 300) px.

## Ajouter un modèle de page

1. Dans `shared/src/interior/templates.ts`, crée un `TemplateDef` :
   - les champs `id`, `name`, `category` et `description` ;
   - `params`, une liste de `ParamDef` (number, boolean, select, text, columns ou fields) : l'interface génère le formulaire toute seule ;
   - `render(ctx)`, qui renvoie des `Prim[]` dessinés **dans `ctx.content`**, ou dans `ctx.trim`/`ctx.page` pour un aplat à fond perdu.
2. Utilise `hline`, `vline`, `fieldLine`, `header`, `pageTitle`, `label` et `ctx.style` (couleurs et épaisseurs validées KDP). Pour l'aléatoire, utilise `ctx.rng()` (déterministe : l'aperçu reproduit exactement le PDF).
3. Ajoute-le au tableau `TEMPLATES`, et à `describeTemplate()` dans `shared/src/marketing/description.ts` pour la description générée.
4. Le test « chaque modèle de page produit des primitives valides » le couvre automatiquement. Lance ensuite `npm test`.

Pour un nouveau **préréglage** de niche, ajoute une entrée dans `PRESETS` (`match` = mots déclencheurs sans accents) : il sera proposé automatiquement à partir des idées importées.

## Vérifier visuellement

```bash
npm test                         # specs, modèles, import xlsx, PDF de tous les préréglages
npm run samples -- ../samples    # PDF d'exemple (8 premières pages + couverture) pour chaque préréglage
npm run samples -- ../samples --guides   # couvertures avec repères
```

Ouvre les PDF, ou convertis-les en PNG avec PyMuPDF, et contrôle :
- le format de page ;
- les polices (toutes en `+Nom` = sous-ensemble embarqué) ;
- les marges miroir recto/verso ;
- le dos et la zone code-barres.

Avant toute publication, fais valider le fichier dans le **Previewer KDP**.

## Pièges connus

- `pdfkit.text()` ajoute une page si le texte déborde : `drawText` passe toujours une option `height`.
- Les largeurs de texte sont *estimées* dans `shared/` (`estimateWidth`, `estimateLines`), car le navigateur et pdfkit ont des métriques différentes. Prévois de la marge dans les blocs.
- Une modification de `specs.ts` change tous les livres existants. Mets à jour `SPECS_CHECKED_ON` et la référence [kdp-specs.md](references/kdp-specs.md) avec la source.

## Assistant IA de l'application

L'onglet « Assistant IA » (Claude) applique ces règles via `server/src/agent/prompt.ts` et ses outils (`server/src/agent/tools.ts`), puis vérifie avec `lintBook`. Quand une règle de cette skill change (specs KDP, listes interdites, méthode des mots-clés, structure de description), reporte-la aussi dans `prompt.ts`, et relance `npm test`.
