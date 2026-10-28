// Listes de contrôle des métadonnées KDP. Toutes les entrées sont en minuscules et sans accents (voir normalize()).

/** Marques déposées fréquentes dans les niches low-content : interdites dans titre, sous-titre et mots-clés. */
export const TRADEMARKS = [
  'disney', 'pixar', 'marvel', 'pokemon', 'reine des neiges', 'frozen', 'moana', 'vaiana', 'winnie', 'pooh', 'mickey', 'minnie', 'barbie', 'lego',
  'harry potter', 'poudlard', 'hogwarts', 'star wars', 'minecraft', 'fortnite', 'roblox', 'pat patrouille', 'paw patrol', 'peppa', 'hello kitty',
  'asterix', 'obelix', 'tintin', 'schtroumpf', 'smurf', 'spiderman', 'spider-man', 'batman', 'superman', 'naruto', 'one piece', 'dragon ball',
  'moleskine', 'leuchtturm', 'exacompta', 'clairefontaine', 'rhodia', 'canson', 'posca', 'tombow', 'staedtler', 'faber-castell', 'faber castell',
  'crayola', 'sharpie', 'stabilo', 'memoniak', 'horko', 'moulin roty', 'aroma zone', 'aroma-zone', 'cookeo', 'thermomix', 'pantone', 'banksy',
  'scholastic', 'hachette', 'nike', 'adidas', 'coca-cola', 'nfl', 'nba', 'fifa', 'sophie la girafe', 'choupi', 'owlet', 'twsbi', 'geneanet',
  'instagram', 'tiktok', 'youtube', 'netflix', 'iphone', 'kakao',
];

/** Termes ambigus (marque ou nom commun) : avertissement seulement. */
export const MAYBE_TRADEMARKS = ['oxford', 'montana', 'bic', 'apple', 'jeep', 'tetris', 'scrabble', 'monopoly', 'olympique', 'olympic'];

/** Auteurs / personnalités cités comme mots-clés dans les fichiers d'idées : interdit par KDP. */
export const AUTHOR_NAMES = [
  'piero san giorgio', 'san giorgio', 'jared diamond', 'beth moore', 'randy mosher', 'celine alvarez', 'john gottman', 'les stroud',
  'mors kochanski', 'alban cambe', 'joan sweeney', 'yves cochet', 'marie kondo', 'bear grylls', 'dave canterbury',
];

export const AMAZON_PROGRAMS = ['kindle unlimited', 'kindle', 'kdp', 'amazon', 'prime', 'audible', 'kdp select'];

export const SUBJECTIVE = ['best', 'meilleur', 'meilleure', 'meilleurs', 'top', 'parfait', 'parfaite', 'perfect', 'incroyable', 'amazing', 'genial', 'bestseller', 'best-seller', 'best seller', 'n°1', 'numero 1', '#1'];

export const TIME_SENSITIVE = ['new', 'nouveau', 'nouvelle', 'nouveaute', 'sale', 'on sale', 'promo', 'promotion', 'soldes', 'limited', 'edition limitee', 'black friday'];

export const GENERIC_WORDS = ['book', 'books', 'livre', 'livres'];

/** Mots génériques à ne pas répéter dans titre + sous-titre (« keyword stuffing »). */
export const TITLE_GENERIC = ['notebook', 'journal', 'carnet', 'cahier', 'gift', 'gifts', 'cadeau', 'cadeaux', 'planner', 'logbook', 'log', 'diary', 'book', 'livre'];

export const MISLEADING_FORMAT = ['pdf', 'ebook', 'e-book', 'logiciel', 'software', 'printable', 'imprimable', 'app', 'application', 'kindle'];

/** Fautes de frappe relevées dans les fichiers d'idées : KDP interdit les fautes volontaires dans les mots-clés. */
export const KNOWN_TYPOS: Record<string, string> = {
  journql: 'journal', stupefiqnt: 'stupéfiant', budjet: 'budget', reoertoir: 'répertoire', repertoir: 'répertoire', personel: 'personnel',
  banquaire: 'bancaire', dessinner: 'dessiner', wisky: 'whisky', thearapy: 'therapy', proffessional: 'professional',
  geneologists: 'genealogists', assesories: 'accessories', notebool: 'notebook', bilbiophiles: 'bibliophiles', suvival: 'survival',
  desaster: 'disaster', bady: 'baby', tacker: 'tracker', professionelle: 'professionnelle', litte: 'little', publiqu: 'publique', sant: 'santé',
  geneologie: 'généalogie', tatoo: 'tattoo',
};

export const REVIEW_WORDS = ['avis', 'etoiles', 'stars', 'review', 'reviews', 'commentaire', 'temoignage', 'testimonial', '5/5'];
export const PRICE_WORDS = ['prix', 'price', 'gratuit', 'free', 'offre', 'offer', 'promo', 'soldes', 'discount', 'remise', '€', '$'];
