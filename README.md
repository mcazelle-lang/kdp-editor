# Book Creator — carnets low-content pour Amazon KDP

Application **Angular 20 + Node/Express** pour transformer des idées de niches en livres low-content prêts à publier sur Amazon KDP :
- **PDF intérieur** : formats KDP, marges miroir, fond perdu, polices embarquées ;
- **PDF de couverture complète** : dos calculé, zone code-barres, gabarits ;
- **fiche produit** contrôlée selon les règles KDP.

## Démarrage

Prérequis : Node.js 20 ou plus.

```bash
npm run install:all     # installe la racine, le serveur et le client
npm run dev             # API sur http://localhost:3000 + interface sur http://localhost:4200
```

Production (une seule URL) :

```bash
npm run build           # compile l'interface Angular
npm start               # sert l'API et l'interface sur http://localhost:3000
```

Au premier lancement, les fichiers `*.xlsx` à la racine (ex. `Low content Q1 2020.xlsx`) sont importés automatiquement dans l'écran **Idées**. Pour les relire : `npm run import:ideas`, ou le bouton « Réimporter le dossier ».

### Activer l'assistant IA

```bash
cp server/.env.example server/.env   # puis renseigner ANTHROPIC_API_KEY (et GEMINI_API_KEY pour les illustrations)
```

Redémarrez ensuite le serveur. Sans clé, l'onglet « Assistant IA » indique ce qu'il manque ; le reste de l'application fonctionne normalement.

## Fonctionnalités

| Écran | Rôle |
|---|---|
| **Mes carnets** | Onglet « En cours » : livres avec vignette, score de conformité, duplication. Onglet « Mes carnets publiés » : carnets importés des rapports KDP, groupés par famille de variantes, avec lien vers la fiche Amazon, ventes par mois, prix et marge, et conseils marketing pour chacun |
| **Niches** | Radar de niches rentables : autocomplétion Amazon (5 marchés), capture des pages Amazon par favori navigateur (prix, avis, BSR), score 0-100 (demande, concurrence, redevance, présence dans la recherche), découverte et analyse par Claude avec recherche web, création du livre en un clic |
| **Compte KDP** | Sans mot de passe : le favori lit ta Bibliothèque KDP (catalogue, formats, statuts, prix) et tes Rapports (exemplaires, redevances, pages lues, par titre et par marché) ; liaison ou import des titres dans l'app ; publication assistée (le favori remplit le formulaire KDP, PDF compris, et c'est toi qui publies) |
| **Idées** | Idées importées depuis Excel (une feuille par catégorie, une colonne par niche), contrôle des mots-clés, création d'un livre en un clic avec préréglage d'intérieur proposé automatiquement |
| **Éditeur › Assistant IA** | Claude (Opus 5.5) prépare une proposition (fiche KDP, intérieur, couverture, illustration Gemini en option), la fait passer par le contrôle KDP jusqu'à zéro erreur, puis l'affiche avec comparatif des couvertures et liste des modifications : tu appliques ou tu ignores |
| **Éditeur › Format** | Broché ou rigide, 17 formats de coupe, 5 papiers et encres, fond perdu, finition, épaisseur du dos, coût d'impression, redevance |
| **Éditeur › Intérieur** | Sections de pages basées sur 16 modèles, page de gauche différenciée, 30 préréglages de niche, aperçu fidèle page par page ou en double page |
| **Éditeur › Couverture** | 10 styles, 18 palettes, 12 motifs vectoriels, bloc titre, typographie, dos, 4e de couverture, illustration, calque du gabarit officiel KDP, vignette Amazon |
| **Éditeur › Fiche KDP** | Titre et sous-titre (≤ 200 caractères), 7 mots-clés contrôlés en direct, description HTML limitée aux balises KDP (génération, correction automatique), catégories, low-content, déclaration IA, prix |
| **Éditeur › Marketing** | Score, problèmes classés, mots-clés suggérés à partir de vos analyses de concurrents, variantes de couleur en un clic, check-list de lancement, calendrier saisonnier |
| **Formats & gabarits** | Tableau officiel des formats KDP, calculateur de couverture, gabarit PDF téléchargeable |
| **Guide KDP** | Résumé des bonnes pratiques de mise en page et de marketing |

### Exports

- `PDF intérieur` : à téléverser dans « Manuscrit » sur KDP.
- `PDF couverture` : à téléverser dans « Couverture », option « J'ai déjà une couverture prête à imprimer ».
- `Fiche KDP (.txt)` : texte à copier dans le formulaire « Détails ».

Validez toujours les fichiers dans le **Previewer KDP**, et commandez un exemplaire d'auteur avant de lancer la promotion.

## Modèles de pages

Page de garde « Ce carnet appartient à », vierge, ligné, pointillé, quadrillé, Seyès, écriture primaire, portées, tablature, planche de BD (toutes différentes), bons à découper, tableau / registre (colonnes, report / total, libellés de lignes), fiche (champs ligne, lignes, cadre, note ★, cases ; 1 à 4 par page ; onglets A-Z), checklist numérotée, semainier, calendrier mensuel.

## Skills Claude Code

Le dossier `.claude/skills/` contient deux skills que Claude Code charge automatiquement dans ce projet :

- **`kdp-mise-en-page`** : spécifications KDP vérifiées (formats, marges, dos, code-barres, polices, traits), réglures de référence, conception de couvertures, ajout de modèles de pages ;
- **`kdp-marketing-low-content`** : recherche de niche, titres, 7 mots-clés, descriptions conformes, catégories, prix, lancement, conformité. Elle contient aussi l'**audit de vos fichiers d'idées 2020** (marques et fautes à retirer, ordre de production).

Exemples de demandes : « prépare la fiche KDP du livre de caisse », « ajoute un modèle de feuille de score de golf », « vérifie que mon intérieur respecte les marges KDP ».

## Recherche de niches

L'écran **Niches** combine trois sources gratuites, sans robot qui aspire Amazon (interdit par ses conditions et bloqué) :

1. **Autocomplétion Amazon** (rayon Livres, FR / US / DE / ES / IT) : ce que les acheteurs tapent vraiment.
   - Le mode alphabet teste « mot a » … « mot z ».
   - Les requêtes sont espacées et mises en cache 24 h.
   - Le point d'accès est public mais non documenté : il peut changer.
2. **Favori « Capturer pour Book Creator »** : à glisser dans la barre de favoris.
   - Sur une page de résultats Amazon, il enregistre le nombre de résultats, les prix, les avis, les notes et les sponsorisés.
   - Sur une fiche produit, il enregistre le BSR et les sous-classements, le nombre de pages, l'éditeur et la date.
   - Il lit uniquement la page que tu as ouverte.
3. **Claude + recherche web** :
   - *Découverte* : à partir d'un thème, Claude explore l'autocomplétion et le web, puis ajoute des niches justifiées au radar.
   - *Analyse* d'une niche : verdict, angle, sous-niches, titres, 7 mots-clés, préréglage, prix, saisonnalité, risques et sources.
   - Claude n'invente aucun chiffre de ventes.

Le **score** sur 100 se décompose ainsi :
- **demande (40 points)** : BSR médian des fiches capturées ;
- **concurrence (35 points)** : avis du top 10 organique ;
- **rentabilité (15 points)** : redevance au prix médian ;
- **autocomplétion (10 points)** : position et nombre de préfixes.

Une marque dans le mot-clé plafonne le score à 10. Les ventes estimées à partir du BSR sont des ordres de grandeur, à recalibrer avec tes ventes KDP (`shared/src/niches/score.ts`, `SALES_MODEL`).

## Compte KDP

### Rapports de ventes (.xlsx)

Le plus fiable : les exports KDP « Redevances du mois précédent » (`KDP_Prior_Month_Royalties-….xlsx`, un fichier par mois).
- Dépose-les à la racine du projet puis clique sur « Importer les fichiers du dossier » (Compte KDP › Ventes, ou Mes carnets › Mes carnets publiés), ou choisis-les avec « Choisir des fichiers… ».
- Chaque titre vendu devient un carnet **publié** dans « Mes carnets », relié à KDP, avec le lien vers sa fiche Amazon. L'intérieur et la couverture sont recréés par préréglage : ce ne sont pas les fichiers publiés.
- Un mois réimporté remplace le précédent ; les carnets déjà créés ne sont pas dupliqués.
- **Conseils par carnet** (`shared/src/kdp-account/advice.ts`), calculés sur les ventes réelles :
  - prix et marge avec le coût d'impression du rapport, paliers de prix et seuil des 60 % ;
  - tendance sur le même mois d'une année à l'autre, titres qui ne vendent plus ;
  - saisonnalité (juin / décembre), variantes, mentions datées ou promesses de conformité dans le titre ;
  - publicité (seulement si la marge le permet) et pistes propres à la niche (`themes.ts`).
- **Diagnostic du catalogue** : redevances contre exemplaires, part des ventes au taux de 50 %, hausse du coût d'impression, familles qui perdent ou gagnent le plus.
- Sur un livre imprimé publié, le titre, le sous-titre et l'auteur ne se modifient plus 72 h après la publication (nouvelle édition) : les conseils en tiennent compte.

### Capture par favori

KDP n'a pas d'API publique pour les auteurs. L'app ne se connecte donc jamais à ton compte et ne stocke aucun mot de passe : tout passe par le favori **Book Creator** (le même que pour les niches), que tu cliques toi-même sur tes pages KDP.

1. **Catalogue** : sur ta Bibliothèque KDP (fais défiler pour afficher tous les titres), clique sur le favori.
   - Chaque format (broché, relié, eBook) devient une ligne : titre, auteur, statut, prix, ASIN ou ISBN, date.
   - Tu peux relier un titre à un livre de l'app ou l'**importer** (fiche recréée avec le préréglage le plus proche ; l'intérieur et la couverture ne sont pas récupérables depuis KDP).
2. **Ventes** : sur la page Rapports, choisis la période, puis clique sur le favori.
   - Une capture par période suffit : une nouvelle capture de la même période remplace l'ancienne.
   - L'onglet Ventes affiche les exemplaires et les redevances par titre et par marché, ainsi que les titres en vente sans aucune vente.
3. **Publication assistée** : dans l'éditeur, « Publier sur KDP → » prépare le livre. Ensuite, sur chaque page du formulaire KDP, clique sur le favori :
   - **Détails** : langue, titre, sous-titre, auteur, description, 7 mots-clés, droits, contenu explicite « non », case low-content ;
   - **Contenu** : encre et papier, fond perdu, finition, PDF intérieur et couverture ;
   - **Tarification** : prix sur la place de marché du livre.

   Un panneau dans la page KDP indique ce qui a été rempli et ce qui reste à faire à la main (catégories, format, déclaration IA), avec des boutons de copie. Tu vérifies, puis **tu cliques toi-même sur Publier**.

La structure des pages KDP n'est pas documentée : l'analyse repose sur le texte visible autour de chaque ASIN ou ISBN, et sur les lignes de tableau pour les rapports (`shared/src/kdp-account/parse.ts`). Le texte brut des 12 dernières captures est conservé : si une capture ne reconnaît rien, copie-le depuis l'onglet **Diagnostic** pour corriger le parseur.

## Assistant IA

Chaque exécution se déroule ainsi :
1. Le serveur lance **Claude** (`claude-opus-5-5`, effort `high`) avec des outils qui modifient une **copie** du livre :
   - `update_listing`, `set_format`, `apply_interior_preset`, `set_interior_sections`, `design_cover` ;
   - `generate_illustration` (si une clé Gemini est configurée) ;
   - `check_book`, qui renvoie les contrôles KDP de l'app.
2. Claude corrige ses propositions jusqu'à ce que le contrôle ne remonte plus d'erreur.
3. La progression s'affiche en direct (flux SSE).
4. La proposition finale n'est appliquée qu'après ton clic.

Détails techniques :
- **Prompt système** : figé et mis en cache (`server/src/agent/prompt.ts`). Il reprend les règles des skills et le catalogue de l'app.
- **Repli automatique** : il est activé côté serveur (`fallbacks: "default"`). Si Opus 5.5 décline une demande, un autre modèle Claude prend le relais.
- **Coût** : chaque exécution consomme des jetons, et l'onglet affiche une estimation du coût de chaque exécution. Modèle, effort et nombre d'étapes se règlent dans `server/.env`.
- **Illustrations** : Imagen a été arrêté par Google le 17/08/2026. Elles passent donc par les modèles d'image Gemini (`gemini-nano-banana-2.1` par défaut, `GEMINI_IMAGE_MODEL` pour changer). Elles portent un filigrane SynthID et doivent être déclarées comme contenu IA sur KDP : la case est cochée automatiquement.

## Firebase

Projet : **kdp-creator-studio** (nom affiché « kdp-book-creator »). Seul **Hosting** est configuré (`firebase.json`, `.firebaserc`) :

```bash
npm run deploy:hosting   # compile l'interface puis la publie sur https://kdp-creator-studio.web.app
```

L'interface hébergée appelle le serveur Node **de ton poste**, par défaut `http://localhost:3000` (modifiable en bas de la barre latérale). Lance donc `npm start` avant de l'utiliser.

Le serveur autorise ces origines (CORS). Chrome peut demander l'autorisation d'accéder au « réseau local » à la première utilisation.

Pour une version entièrement en ligne, l'API devra être déployée (Cloud Functions ou Cloud Run, forfait Blaze), avec un stockage Firestore et Storage à la place de `server/data/`.

## Architecture

```
shared/   Logique métier TypeScript partagée (specs KDP, géométrie, modèles de pages,
          couvertures, rendu SVG, contrôles marketing). Même code pour l'aperçu et le PDF.
server/   Express 5 : API REST, import xlsx (exceljs), PDF (pdfkit + polices @fontsource
          embarquées), assistant IA (server/src/agent : @anthropic-ai/sdk + @google/genai),
          stockage JSON dans server/data/ (db.json + uploads/)
client/   Angular 20 (standalone, signals, zoneless)
```

Commandes utiles :

```bash
npm test                 # 57 tests : specs KDP, modèles, import Excel, PDF, assistant, niches, compte KDP (parseurs, rapports .xlsx, conseils, routes)
npm run typecheck
npm run samples -- out   # PDF d'exemple de chaque préréglage dans ./server/out
```

## À savoir

- Les règles KDP (formats, coûts d'impression, redevances, métadonnées) ont été relevées le **14/10/2026** sur l'aide KDP (`shared/src/kdp/specs.ts`, `pricing.ts`). KDP les fait évoluer : revérifiez avant publication.
- **Rigide** : KDP ne publie pas la formule d'épaisseur du dos. Saisissez les dimensions du [calculateur KDP](https://kdp.amazon.com/cover-calculator) dans l'onglet Format, ou importez son gabarit en calque.
- **Registres réglementés** (personnel, CSE, stupéfiants) : la mise en page est fournie, mais la conformité légale du contenu reste à vérifier.
- Images acceptées : PNG et JPEG (300 DPI conseillés).
