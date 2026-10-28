// Thèmes de niche des carnets publiés : nature de l'achat et pistes propres à la niche.
// Les pistes sont des méthodes à appliquer, jamais des chiffres de marché (non vérifiables sans capture du marché).

export interface NicheTip {
  title: string;
  detail: string;
}

export interface NicheTheme {
  id: string;
  label: string;
  /** Testé sur le titre normalisé (minuscules, sans accents) */
  re: RegExp;
  /** cadeau : achat d'impulsion saisonnier ; pro : achat utilitaire, peu sensible au prix ; pratique : usage personnel */
  kind: 'cadeau' | 'pro' | 'pratique';
  /** Produit propre à un pays (réglementation, vocabulaire) : pas de traduction conseillée */
  local?: boolean;
  /** Redevance visée par exemplaire (défaut : 3 pour un produit pro, 1,5 sinon) */
  targetRoyalty?: number;
  tips: NicheTip[];
}

const RADAR: NicheTip = {
  title: 'Mesure la concurrence avant de retoucher la fiche',
  detail: 'Ouvre la recherche Amazon du mot-clé principal et capture-la avec le favori (écran Niches), puis 3 à 5 fiches du top 10 : prix, avis et BSR des concurrents disent si la baisse vient de la concurrence ou de ta fiche.',
};

export const THEMES: NicheTheme[] = [
  {
    id: 'genealogie', label: 'Généalogie', kind: 'cadeau',
    re: /genealog|arbre|ancetre|stammbaum|vorfahren|family tree|pedigree|antepasados|antenati|albero/,
    tips: [
      { title: 'Ajoute une version reliée', detail: 'Un livre de famille se garde des années : une édition à couverture rigide, liée au même titre dans KDP, se vend plus cher pour Noël et les naissances.' },
      { title: 'Montre l\'intérieur', detail: 'Les acheteurs veulent voir l\'arbre et les fiches avant d\'acheter : ajoute des visuels de l\'intérieur dans le Contenu A+ (KDP › Marketing).' },
      RADAR,
    ],
  },
  {
    id: 'nounou', label: 'Liaison nounou', kind: 'pratique', local: true,
    re: /nounou|assistante? maternelle|liaison|creche/,
    tips: [
      { title: 'Prépare la rentrée', detail: 'L\'achat se fait au début du contrat d\'accueil : prix, couverture et publicité doivent être prêts avant fin août.' },
      { title: 'Justifie un prix plus élevé par l\'intérieur', detail: 'Pages de coordonnées, autorisations, suivi des heures, santé et allergies, bilan mensuel : un intérieur plus complet que la concurrence rend un prix de 7,99 € crédible.' },
      { title: 'Teste les formulations des parents', detail: 'Lance l\'autocomplétion du radar Niches sur « cahier de liaison », « carnet assistante maternelle », « cahier de transmission » et reporte les expressions trouvées dans les 7 mots-clés.' },
    ],
  },
  {
    id: 'registre', label: 'Registre réglementé', kind: 'pro', local: true, targetRoyalty: 4,
    re: /registre|stupefiant|personnel|cse\b|rgpd|securite/,
    tips: [
      { title: 'Vérifie les textes en vigueur', detail: 'Un registre professionnel doit suivre la réglementation actuelle : relis les articles cités et mets la date de vérification dans la description. Ne promets pas « conforme » sans cette vérification.' },
      { title: 'Prix de produit professionnel', detail: 'L\'acheteur est une entreprise ou une officine, peu sensible au prix : en A4, vise le haut de la fourchette 9,99–14,99 € (taux de 60 %).' },
    ],
  },
  {
    id: 'budget', label: 'Budget', kind: 'pratique',
    re: /budget|kakebo|kakeibo/,
    tips: [
      { title: 'Suis la tendance du mot-clé', detail: 'Une mode comme le kakebo retombe : vérifie dans l\'autocomplétion du radar Niches si le mot est encore tapé, et bascule les mots-clés vers « budget familial », « gestion budget mensuel ».' },
      { title: 'Prépare janvier', detail: 'Les bonnes résolutions font le pic : fiche et prix prêts dès décembre. Une édition datée de l\'année se vend mieux, à condition de la mettre à jour chaque année.' },
    ],
  },
  {
    id: 'compta', label: 'Comptabilité', kind: 'pro',
    re: /caisse|recettes et depenses|livre de compte|cahier de compte - recettes|inventaire|comptab|livre journal/,
    tips: [
      { title: 'Vise le seuil des 60 %', detail: 'Cahier A4 pour commerçants et auto-entrepreneurs : un achat utilitaire qui supporte 9,99 € et plus.' },
      { title: 'Prépare janvier', detail: 'Nouvel exercice, nouveau cahier : fiche et publicité prêtes dès décembre.' },
      { title: 'Cible les métiers', detail: 'Mots-clés par public : « auto-entrepreneur », « association », « commerçant », « artisan », « micro-entreprise ».' },
    ],
  },
  {
    id: 'mots-de-passe', label: 'Mots de passe', kind: 'cadeau',
    re: /mots? de passe|password|codes? secrets?|identifiants/,
    tips: [
      { title: 'Parle aux seniors', detail: 'Grand format, gros caractères et onglets alphabétiques : c\'est l\'acheteur principal, et un cadeau de Noël fréquent.' },
      { title: 'Titres humoristiques : reste sobre', detail: 'Un mot grossier dans le titre peut faire restreindre le livre dans la recherche : garde une couverture et des mots-clés neutres.' },
    ],
  },
  {
    id: 'degustation', label: 'Dégustation', kind: 'cadeau',
    re: /wh?isk|tasting|degustation|\bvins?\b|biere|rhum|\bgin\b/,
    tips: [
      { title: 'Prix de cadeau', detail: 'Un journal de dégustation s\'offre pour la fête des pères et Noël : le repère d\'un carnet 6×9 de 100 à 120 pages est de 6,99 à 8,99, et c\'est ce palier qui crée la marge.' },
      { title: 'Décline la niche', detail: 'Même intérieur, autres boissons (vin, bière, rhum, gin) et autres langues : chaque variante cible ses propres mots-clés.' },
    ],
  },
  {
    id: 'herbier', label: 'Herbier', kind: 'pratique',
    re: /herbier|botani|plantes|herbarium/,
    tips: [
      { title: 'Saison des cueillettes', detail: 'Le besoin naît au printemps et en été (sorties, écoles) : fiche et publicité prêtes en mars.' },
      { title: 'Choisis ton public', detail: 'Enfant (activité, écoles) ou adulte (botanique) : un sous-titre clair pour l\'un des deux convertit mieux qu\'un sous-titre mixte.' },
    ],
  },
  {
    id: 'bucket-list', label: 'Bucket list / couple', kind: 'cadeau',
    re: /bucket list|aventures?|couple|je t'aime|love|amour|adventure/,
    tips: [
      { title: 'Cale-toi sur les fêtes', detail: 'Saint-Valentin, anniversaires de couple, mariages : prépare la fiche et la publicité 6 à 8 semaines avant.' },
    ],
  },
  {
    id: 'dessin', label: 'Dessin / BD', kind: 'cadeau',
    re: /sketch|dessin|graffiti|blackbook|comic|\bbd\b|manga/,
    tips: [
      { title: 'Montre les gabarits', detail: 'Pour un carnet de dessin, l\'aperçu des pages (cases, gabarits de murs ou de trains) fait la vente : ajoute ces visuels au Contenu A+.' },
    ],
  },
  {
    id: 'recettes', label: 'Recettes DIY', kind: 'pratique',
    re: /recettes|cosmetique|menager|zero dechet|naturel/,
    tips: [
      { title: 'Précise l\'usage', detail: 'Cosmétiques maison, produits ménagers, cuisine : un titre centré sur un seul usage se trouve plus facilement qu\'un titre qui mélange tout.' },
    ],
  },
  {
    id: 'bebe', label: 'Suivi bébé', kind: 'cadeau',
    re: /bebe|nouveau-ne|naissance|baby/,
    tips: [
      { title: 'Cadeau de naissance', detail: 'Mots-clés « cadeau naissance », « liste de naissance », « baby shower » : l\'acheteur est souvent un proche, pas le parent.' },
    ],
  },
  {
    id: 'survie', label: 'Survivalisme', kind: 'pratique',
    re: /surviv|prepper|bush ?craft|i'm ready/,
    tips: [RADAR],
  },
  {
    id: 'carnet', label: 'Carnet générique', kind: 'cadeau',
    re: /notebook|composition|journal|carnet|cahier|life is|hello my name|scripts/,
    tips: [
      { title: 'Donne-lui une niche', detail: 'Un carnet ligné générique affronte des milliers de concurrents : transforme-le en carnet d\'un usage précis (métier, passion, événement) ou retire-le.' },
    ],
  },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/’/g, "'");

export const themeOf = (title: string): NicheTheme | null => THEMES.find((t) => t.re.test(norm(title))) ?? null;
