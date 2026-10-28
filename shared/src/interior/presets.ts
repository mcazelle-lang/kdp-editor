import type { Lang } from '../i18n';
import type { BookFormat, Params, Section } from '../model';
import { uid } from '../model';
import type { ColumnDef, FieldDef } from './kit';

// Préréglages d'intérieur pour les niches low-content (dont celles des fichiers « Low content Q1/Q4 2020.xlsx »).
type S = { templateId: string; pages: number; params?: Params; name?: string; alt?: { templateId: string; params?: Params } };

export interface Preset {
  id: string;
  name: string;
  description: string;
  /** Mots déclencheurs (minuscules, sans accents) pour proposer ce préréglage depuis une idée */
  match: string[];
  format: Partial<BookFormat>;
  sections: (lang: Lang) => S[];
}

const fr = (lang: Lang) => lang === 'fr';
const cols = (...c: [string, number][]): ColumnDef[] => c.map(([label, width]) => ({ label, width }));
const f = (label: string, type: FieldDef['type'] = 'line', extra: Partial<FieldDef> = {}): FieldDef => ({ label, type, ...extra });
const owner = (lang: Lang): S => ({ templateId: 'title-page', pages: 1, name: fr(lang) ? 'Page de propriétaire' : 'Owner page' });

export const PRESETS: Preset[] = [
  {
    id: 'notebook-lined',
    name: 'Carnet ligné classique',
    description: 'Page propriétaire + 120 pages lignées (college ruled). Le best-seller « couleur tendance ».',
    match: ['carnet de notes', 'couleur tendance', 'citation', 'quote', 'lined notebook'],
    format: { trimId: '6x9', ink: 'bw-white', bleed: false },
    sections: (l) => [owner(l), { templateId: 'lined', pages: 119, params: { spacing: 7.1 } }],
  },
  {
    id: 'bullet-journal',
    name: 'Bullet journal (dot grid)',
    description: 'Grille de points 5 mm, 120 pages.',
    match: ['bullet', 'dot', 'pointille', 'dotted'],
    format: { trimId: '5.5x8.5', ink: 'bw-white' },
    sections: (l) => [owner(l), { templateId: 'dotted', pages: 119 }],
  },
  {
    id: 'cahier-seyes',
    name: 'Cahier Seyès',
    description: 'Grands carreaux français, 96 pages.',
    match: ['seyes', 'grands carreaux', 'ecolier'],
    format: { trimId: 'a4', ink: 'bw-white' },
    sections: () => [{ templateId: 'seyes', pages: 96 }],
  },
  {
    id: 'sketchbook',
    name: 'Sketchbook / carnet de dessin',
    description: 'Pages vierges encadrées, grand format.',
    match: ['sketch', 'dessin', 'blackbook', 'tatouage', 'tattoo', 'graffiti', 'croquis', 'drawing'],
    format: { trimId: '8.5x11', ink: 'bw-white' },
    sections: (l) => [owner(l), { templateId: 'blank', pages: 99, params: { frame: 'solid' } }],
  },
  {
    id: 'comic-blank',
    name: 'Bande dessinée vierge',
    description: '100 planches toutes différentes (mise en page aléatoire déterministe).',
    match: ['bande dessinee', 'comic', 'bd', 'manga', 'planche'],
    format: { trimId: '8.5x11', ink: 'bw-white' },
    sections: (l) => [owner(l), { templateId: 'comic', pages: 99, params: { layout: 'varie' } }],
  },
  {
    id: 'music-staff',
    name: 'Cahier de musique',
    description: 'Portées (12 par page) en grand format.',
    match: ['musique', 'partition', 'portee', 'music', 'piano', 'violon', 'song'],
    format: { trimId: 'a4', ink: 'bw-white' },
    sections: () => [{ templateId: 'music', pages: 100, params: { staves: 12 } }],
  },
  {
    id: 'music-seyes',
    name: 'Musique + Seyès (alterné)',
    description: 'Portées à droite, Seyès à gauche : le cahier de musique scolaire français.',
    match: ['portee et seyes', 'musique avec portee et seyes'],
    format: { trimId: 'a4', ink: 'bw-white' },
    sections: () => [{ templateId: 'music', pages: 96, params: { staves: 8 }, alt: { templateId: 'seyes' } }],
  },
  {
    id: 'guitar-tab',
    name: 'Tablatures guitare',
    description: 'Diagrammes d\'accords + tablatures 6 cordes.',
    match: ['guitar', 'guitare', 'tablature'],
    format: { trimId: '8.5x11', ink: 'bw-white' },
    sections: () => [{ templateId: 'tablature', pages: 100 }],
  },
  {
    id: 'inventory',
    name: 'Livre d\'inventaire',
    description: 'Tableau 30 lignes à couleurs alternées, A4.',
    match: ['inventaire', 'inventory', 'stock'],
    format: { trimId: 'a4', ink: 'bw-white' },
    sections: (l) => [{ templateId: 'table', pages: 100, params: fr(l)
      ? { title: 'Inventaire', headerFields: 'Période;Responsable', rows: 30, columns: cols(['Date', 1.1], ['Référence', 1.4], ['Désignation', 3], ['Entrées', 1], ['Sorties', 1], ['Stock', 1], ['Observations', 2]) }
      : { title: 'Inventory', headerFields: 'Period;Manager', rows: 30, columns: cols(['Date', 1.1], ['Ref.', 1.4], ['Item', 3], ['In', 1], ['Out', 1], ['Stock', 1], ['Notes', 2]) } }],
  },
  {
    id: 'cash-book',
    name: 'Livre de caisse',
    description: 'Recettes / dépenses / solde, report en haut et total en bas.',
    match: ['caisse', 'cash', 'livre de caisse'],
    format: { trimId: 'a4', ink: 'bw-white' },
    sections: (l) => [{ templateId: 'table', pages: 100, params: fr(l)
      ? { title: 'Livre de caisse', headerFields: 'Mois;Année', rows: 30, footer: 'report-total', columns: cols(['Date', 1], ['N° pièce', 1], ['Libellé', 3.4], ['Recettes', 1.3], ['Dépenses', 1.3], ['Solde', 1.3]) }
      : { title: 'Cash book', headerFields: 'Month;Year', rows: 30, footer: 'report-total', columns: cols(['Date', 1], ['Receipt #', 1], ['Description', 3.4], ['Income', 1.3], ['Expense', 1.3], ['Balance', 1.3]) } }],
  },
  {
    id: 'income-expense',
    name: 'Cahier de compte recettes-dépenses',
    description: 'Objet, moyen de paiement, recettes, dépenses ; 30 lignes.',
    match: ['recettes et depenses', 'cahier de compte', 'livre de recette', 'comptabilite', 'ledger', 'account'],
    format: { trimId: 'a4', ink: 'bw-white' },
    sections: (l) => [{ templateId: 'table', pages: 100, params: fr(l)
      ? { headerFields: 'Mois;Solde d\'entrée;Solde de sortie', rows: 30, footer: 'total', columns: cols(['Date', 1], ['Objet de l\'opération', 3.2], ['Mode de paiement', 1.6], ['Recettes', 1.3], ['Dépenses', 1.3]) }
      : { headerFields: 'Month;Opening balance;Closing balance', rows: 30, footer: 'total', columns: cols(['Date', 1], ['Description', 3.2], ['Payment method', 1.6], ['Income', 1.3], ['Expense', 1.3]) } }],
  },
  {
    id: 'budget-planner',
    name: 'Budget planner',
    description: 'Pour chaque mois : calendrier + suivi des dépenses (2 pages tableau).',
    match: ['budget', 'kakeibo', 'kakebo', 'planner'],
    format: { trimId: '6x9', ink: 'bw-white' },
    sections: (l) => [owner(l),
      ...Array.from({ length: 12 }, (_, m) => [
        { templateId: 'monthly', pages: 1, name: `${fr(l) ? 'Mois' : 'Month'} ${m + 1}` },
        { templateId: 'table', pages: 3, params: fr(l)
          ? { title: 'Dépenses', rows: 22, footer: 'total', columns: cols(['Date', 1], ['Dépense', 3], ['Catégorie', 1.6], ['Montant', 1.2]) }
          : { title: 'Expenses', rows: 22, footer: 'total', columns: cols(['Date', 1], ['Expense', 3], ['Category', 1.6], ['Amount', 1.2]) } },
      ] as S[]).flat(),
      { templateId: 'lined', pages: 11, name: 'Notes' }],
  },
  {
    id: 'password-book',
    name: 'Carnet de mots de passe',
    description: '4 fiches par page, onglets A-Z répartis automatiquement.',
    match: ['mot de passe', 'password', 'passwort', 'contrasena', 'codes secrets', 'identifiant'],
    format: { trimId: '5.5x8.5', ink: 'bw-white' },
    sections: (l) => [owner(l), { templateId: 'form', pages: 104, params: {
      alphabet: true, perPage: 3, boxed: true,
      fields: fr(l)
        ? [f('Site'), f('Adresse URL'), f('Identifiant', 'line', { half: true }), f('E-mail', 'line', { half: true }), f('Mot de passe'), f('Question / réponse secrète')]
        : [f('Website'), f('URL'), f('Username', 'line', { half: true }), f('Email', 'line', { half: true }), f('Password'), f('Security question / answer')],
    } }, { templateId: 'lined', pages: 5, name: 'Notes' }],
  },
  {
    id: 'recipe-book',
    name: 'Carnet de recettes de cuisine',
    description: 'Une recette par page : temps, portions, ingrédients, préparation.',
    match: ['recette de cuisine', 'recipe', 'cookbook', 'cuisine'],
    format: { trimId: '7.5x9.25', ink: 'bw-white' },
    sections: (l) => [owner(l), { templateId: 'table', pages: 2, params: fr(l) ? { title: 'Sommaire', rows: 28, zebra: true, columns: cols(['Recette', 4], ['Page', 1]) } : { title: 'Contents', rows: 28, columns: cols(['Recipe', 4], ['Page', 1]) } },
      { templateId: 'form', pages: 100, params: { title: '', fields: fr(l)
        ? [f('Recette'), f('Portions', 'line', { half: true }), f('Préparation', 'line', { half: true }), f('Cuisson', 'line', { half: true }), f('Difficulté', 'rating', { half: true }), f('Ingrédients', 'lines', { lines: 8 }), f('Étapes', 'lines', { lines: 12 })]
        : [f('Recipe'), f('Serves', 'line', { half: true }), f('Prep time', 'line', { half: true }), f('Cook time', 'line', { half: true }), f('Difficulty', 'rating', { half: true }), f('Ingredients', 'lines', { lines: 8 }), f('Directions', 'lines', { lines: 12 })] } }]
  },
  {
    id: 'diy-recipes',
    name: 'Recettes DIY cosmétiques & ménagers',
    description: 'Fiches recette « fait maison » + suivi des dates de conservation.',
    match: ['cosmetique', 'menager', 'diy', 'naturelles', 'zero dechet'],
    format: { trimId: '7.5x9.25', ink: 'bw-white' },
    sections: () => [owner('fr'),
      { templateId: 'form', pages: 100, params: { fields: [f('Produit'), f('Catégorie', 'checks', { options: 'Cosmétique|Ménager|Bien-être' }), f('Temps de réalisation', 'line', { half: true }), f('Conservation', 'line', { half: true }), f('Ingrédients', 'lines', { lines: 6 }), f('Matériel', 'lines', { lines: 3 }), f('Préparation', 'lines', { lines: 9 }), f('Utilisation', 'lines', { lines: 3 })] } },
      { templateId: 'table', pages: 7, params: { title: 'Produits réalisés', rows: 26, columns: cols(['Produit', 3], ['Fabriqué le', 1.3], ['À utiliser avant', 1.5], ['Notes', 2]) } }],
  },
  {
    id: 'tasting-journal',
    name: 'Journal de dégustation (whisky, vin, bière)',
    description: 'Fiche par dégustation avec note, couleur, nez, bouche, finale.',
    match: ['tasting', 'degustation', 'whisky', 'whiskey', 'wine', 'beer', 'biere', 'vin'],
    format: { trimId: '6x9', ink: 'bw-white' },
    sections: (l) => [owner(l), { templateId: 'form', pages: 100, params: { perPage: 1, fields: fr(l)
      ? [f('Nom'), f('Distillerie / domaine', 'line', { half: true }), f('Âge / millésime', 'line', { half: true }), f('Prix', 'line', { half: true }), f('Degré', 'line', { half: true }), f('Couleur', 'checks', { options: 'Clair|Doré|Ambré|Foncé' }), f('Nez', 'lines', { lines: 2 }), f('Bouche', 'lines', { lines: 2 }), f('Finale', 'lines', { lines: 2 }), f('Note', 'rating'), f('Notes', 'lines', { lines: 3 })]
      : [f('Name'), f('Distillery', 'line', { half: true }), f('Age', 'line', { half: true }), f('Price', 'line', { half: true }), f('ABV', 'line', { half: true }), f('Color', 'checks', { options: 'Pale|Gold|Amber|Dark' }), f('Nose', 'lines', { lines: 2 }), f('Palate', 'lines', { lines: 2 }), f('Finish', 'lines', { lines: 2 }), f('Rating', 'rating'), f('Notes', 'lines', { lines: 3 })] } }],
  },
  {
    id: 'reading-log',
    name: 'Reading log / journal de lecture',
    description: 'Liste de lecture + une fiche par livre.',
    match: ['reading', 'lecture', 'book lover', 'bibliophile'],
    format: { trimId: '6x9', ink: 'bw-white' },
    sections: (l) => [owner(l),
      { templateId: 'table', pages: 4, params: fr(l) ? { title: 'Ma liste de lecture', rows: 25, columns: cols(['Titre', 3], ['Auteur', 2], ['Lu le', 1]) } : { title: 'Books to read', rows: 25, columns: cols(['Title', 3], ['Author', 2], ['Done', 1]) } },
      { templateId: 'form', pages: 100, params: { fields: fr(l)
        ? [f('Titre'), f('Auteur'), f('Genre', 'line', { half: true }), f('Pages', 'line', { half: true }), f('Commencé le', 'line', { half: true }), f('Terminé le', 'line', { half: true }), f('Ma note', 'rating'), f('Résumé', 'lines', { lines: 6 }), f('Citations préférées', 'lines', { lines: 4 })]
        : [f('Title'), f('Author'), f('Genre', 'line', { half: true }), f('Pages', 'line', { half: true }), f('Started', 'line', { half: true }), f('Finished', 'line', { half: true }), f('My rating', 'rating'), f('Summary', 'lines', { lines: 6 }), f('Favorite quotes', 'lines', { lines: 4 })] } }],
  },
  {
    id: 'staff-register',
    name: 'Registre unique du personnel',
    description: '2 fiches salarié par page (contenu à faire valider : obligations légales).',
    match: ['registre du personnel', 'registre unique', 'personnel'],
    format: { trimId: 'a4', ink: 'bw-white' },
    sections: () => [{ templateId: 'form', pages: 100, params: { perPage: 2, boxed: true, fields: [
      f('Nom', 'line', { half: true }), f('Prénom', 'line', { half: true }), f('Sexe', 'checks', { options: 'F|M', half: true }), f('Date de naissance', 'line', { half: true }), f('Nationalité', 'line', { half: true }), f('N° titre de travail', 'line', { half: true }),
      f('Emploi', 'line', { half: true }), f('Qualification', 'line', { half: true }), f('Date d\'entrée', 'line', { half: true }), f('Date de sortie', 'line', { half: true }),
      f('Contrat', 'checks', { options: 'CDI|CDD|Temps partiel|Apprentissage|Stage|Intérim' }), f('Observations', 'lines', { lines: 2 }),
    ] } }],
  },
  {
    id: 'drug-register',
    name: 'Registre des stupéfiants (officine)',
    description: 'Balances journalière et mensuelle, autres substances, destruction (contenu réglementaire à faire valider).',
    match: ['stupefiant'],
    format: { trimId: 'a4', ink: 'bw-white' },
    sections: () => [
      { templateId: 'table', pages: 50, name: 'Balance journalière', params: { title: 'Médicaments classés « stupéfiants » — balance journalière', headerFields: 'Désignation;Forme / dosage;Unité', rows: 26, footer: 'report-total', columns: cols(['Date', 1], ['Fournisseur / prescripteur / patient', 3], ['N° ordonnancier', 1.3], ['Entrées', 1], ['Sorties', 1], ['Stock', 1], ['Visa', 0.9]) } },
      { templateId: 'table', pages: 24, name: 'Balance mensuelle', params: { title: 'Balance mensuelle et inventaire annuel', headerFields: 'Désignation;Année', rows: 13, rowLabels: 'Janvier;Février;Mars;Avril;Mai;Juin;Juillet;Août;Septembre;Octobre;Novembre;Décembre;Inventaire', columns: cols(['Mois', 1.4], ['Stock début', 1], ['Entrées', 1], ['Sorties', 1], ['Stock théorique', 1.1], ['Stock réel', 1], ['Écart', 0.9], ['Visa', 0.9]) } },
      { templateId: 'table', pages: 14, name: 'Autres substances', params: { title: 'Autres substances et préparations — balance journalière', headerFields: 'Désignation;Unité', rows: 26, footer: 'report-total', columns: cols(['Date', 1], ['Origine / destination', 3], ['Entrées', 1], ['Sorties', 1], ['Stock', 1], ['Visa', 0.9]) } },
      { templateId: 'table', pages: 6, name: 'Destruction', params: { title: 'Produits stupéfiants pour destruction', rows: 24, columns: cols(['Date', 1], ['Produit', 2.4], ['Quantité', 1], ['Motif (périmé / rapporté)', 1.8], ['Témoin', 1.3], ['Visa', 0.9]) } },
      { templateId: 'lined', pages: 4, name: 'Notes' },
    ],
  },
  {
    id: 'cse-register',
    name: 'Registre du CSE (délégation du personnel)',
    description: 'Demandes de la délégation à gauche, réponses de l\'employeur à droite (contenu réglementaire à faire valider).',
    match: ['cse', 'comite social', 'delegation du personnel'],
    format: { trimId: 'a4', ink: 'bw-white' },
    sections: () => [
      { templateId: 'title-page', pages: 1, params: { heading: 'Registre du Comité Social et Économique', fields: 'Entreprise;Établissement;Période du;au' } },
      { templateId: 'form', pages: 98, params: { title: 'Réponse de l\'employeur', fields: [f('Demande n°', 'line', { half: true }), f('Date de la réponse', 'line', { half: true }), f('Réponse motivée', 'lines', { lines: 22 }), f('Nom et signature', 'line')] },
        alt: { templateId: 'form', params: { title: 'Demandes de la délégation du personnel', fields: [f('Réunion du', 'line', { half: true }), f('Demande n°', 'line', { half: true }), f('Objet', 'line'), f('Demande', 'lines', { lines: 22 }), f('Remise le', 'line')] } } },
      { templateId: 'lined', pages: 1, name: 'Notes' },
    ],
  },
  {
    id: 'love-coupons',
    name: 'Bons pour amoureux (coupons)',
    description: 'Bons à découper numérotés, 4 par page.',
    match: ['bons pour', 'bon pour', 'love ticket', 'coupon', 'cheque cadeau', 'chequier'],
    format: { trimId: '6x9', ink: 'bw-white' },
    sections: (l) => [owner(l), { templateId: 'coupons', pages: 50, params: { rows: 4, cols: '1' } }, { templateId: 'coupons', pages: 1, params: { rows: 4, heading: fr(l) ? 'BON JOKER' : 'WILDCARD' } }],
  },
  {
    id: 'baby-firsts',
    name: 'Mes premières fois (album bébé)',
    description: 'Une page par « première fois » : date, âge, photo, souvenir.',
    match: ['premieres fois', 'first times', 'first year', 'souvenirs d\'enfance'],
    format: { trimId: '8.5x11', ink: 'bw-white' },
    sections: (l) => [owner(l), { templateId: 'form', pages: 59, params: { fields: fr(l)
      ? [f('Ma première fois'), f('Date', 'line', { half: true }), f('Âge', 'line', { half: true }), f('Photo', 'box', { lines: 12 }), f('Ce qui s\'est passé', 'lines', { lines: 7 })]
      : [f('My first'), f('Date', 'line', { half: true }), f('Age', 'line', { half: true }), f('Photo', 'box', { lines: 12 }), f('What happened', 'lines', { lines: 7 })] } }],
  },
  {
    id: 'appointment-book',
    name: 'Carnet de rendez-vous',
    description: 'Une journée par page, créneaux de 30 minutes de 8 h à 19 h 30.',
    match: ['rendez-vous', 'rendez vous', 'appointment'],
    format: { trimId: '8.5x11', ink: 'bw-white' },
    sections: (l) => [{ templateId: 'table', pages: 312, params: {
      headerFields: 'Date', rows: 24,
      rowLabels: Array.from({ length: 24 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`).join(';'),
      columns: fr(l) ? cols(['Heure', 0.8], ['Client', 2.4], ['Téléphone', 1.6], ['Prestation', 2.2], ['Notes', 1.6]) : cols(['Time', 0.8], ['Client', 2.4], ['Phone', 1.6], ['Service', 2.2], ['Notes', 1.6]),
    } }],
  },
  {
    id: 'baby-log',
    name: 'Carnet de suivi bébé',
    description: 'Un jour par page : repas, sommeil, changes, santé, humeur.',
    match: ['bebe', 'baby', 'nourrisson', 'newborn', 'allaitement'],
    format: { trimId: '7.5x9.25', ink: 'bw-white' },
    sections: (l) => [owner(l), { templateId: 'table', pages: 100, params: fr(l)
      ? { headerFields: 'Date;Poids;Température', rows: 18, columns: cols(['Heure', 1], ['Repas / tétée', 2], ['Quantité', 1], ['Change', 1], ['Sommeil', 1.3], ['Remarques', 2.2]) }
      : { headerFields: 'Date;Weight;Temperature', rows: 18, columns: cols(['Time', 1], ['Feeding', 2], ['Amount', 1], ['Diaper', 1], ['Sleep', 1.3], ['Notes', 2.2]) } }],
  },
  {
    id: 'nanny-liaison',
    name: 'Carnet de liaison nounou',
    description: 'Une semaine par page + pages de notes.',
    match: ['nounou', 'assistante maternelle', 'liaison', 'nanny'],
    format: { trimId: '5.5x8.5', ink: 'bw-white' },
    sections: (l) => [owner(l), { templateId: 'weekly', pages: 112, params: { layout: 'list' } }, { templateId: 'lined', pages: 7, name: 'Notes' }],
  },
  {
    id: 'bucket-list',
    name: 'Bucket list (couple, famille)',
    description: '100 idées numérotées puis 50 doubles pages « aventure » : récit à droite, souvenirs à gauche.',
    match: ['bucket', 'choses a faire', 'things to do', 'aventure', 'adventure'],
    format: { trimId: '7x10', ink: 'bw-white' },
    sections: (l) => [owner(l),
      { templateId: 'checklist', pages: 5, params: { title: fr(l) ? 'Notre bucket list' : 'Our bucket list', maxItems: 100, spacing: 10.5 } },
      { templateId: 'form', pages: 100, params: { fields: fr(l)
        ? [f('Aventure n°'), f('Réalisée le', 'line', { half: true }), f('Lieu', 'line', { half: true }), f('Avec qui', 'line'), f('Notre récit', 'lines', { lines: 14 }), f('Note', 'rating')]
        : [f('Adventure #'), f('Done on', 'line', { half: true }), f('Place', 'line', { half: true }), f('With', 'line'), f('Our story', 'lines', { lines: 14 }), f('Rating', 'rating')] },
        alt: { templateId: 'blank', params: { frame: 'rounded', label: fr(l) ? 'Photos & souvenirs' : 'Photos & memories' } } }],
  },
  {
    id: 'herbarium',
    name: 'Herbier',
    description: 'Page de gauche pour coller le spécimen, page de droite pour la fiche botanique (A4).',
    match: ['herbier', 'herbarium', 'botani', 'plante'],
    format: { trimId: 'a4', ink: 'bw-white' },
    sections: () => [owner('fr'), { templateId: 'form', pages: 110, params: { fields: [
      f('Famille'), f('Nom latin (genre, espèce, cultivar)'), f('Nom vernaculaire'), f('Date de récolte', 'line', { half: true }), f('Lieu', 'line', { half: true }), f('Écologie / milieu', 'lines', { lines: 2 }), f('Description', 'lines', { lines: 8 }), f('Usages', 'lines', { lines: 4 }),
    ] }, alt: { templateId: 'blank', params: { frame: 'dashed', label: 'Collez votre spécimen ici' } } }],
  },
  {
    id: 'primary-composition',
    name: 'Cahier d\'écriture primaire',
    description: 'Draw & write : moitié dessin, moitié lignes avec ligne médiane (K-2).',
    match: ['primary composition', 'handwriting', 'ecriture', 'kindergarten', 'calligraph'],
    format: { trimId: '7.5x9.25', ink: 'bw-white' },
    sections: (l) => [owner(l), { templateId: 'handwriting', pages: 109 }],
  },
  {
    id: 'code-notebook',
    name: 'Cahier de programmation',
    description: 'Lignes numérotées + en-tête titre/date pour écrire des algorithmes.',
    match: ['programmation', 'code', 'algorithm', 'developer', 'scripting'],
    format: { trimId: '6x9', ink: 'bw-white' },
    sections: (l) => [owner(l), { templateId: 'lined', pages: 119, params: { numbered: true, header: 'title-date', spacing: 6.35 } }],
  },
  {
    id: 'guest-book',
    name: 'Livre d\'or',
    description: 'Messages des invités (mariage, baptême, retraite, anniversaire, entreprise).',
    match: ['livre d\'or', 'livre dor', 'guest book', 'mariage', 'bapteme', 'retraite', 'anniversaire', 'deces'],
    format: { trimId: '8.25x8.25', ink: 'bw-white' },
    sections: (l): S[] => [{ templateId: 'title-page', pages: 1, params: fr(l) ? { heading: 'Livre d\'or', fields: 'Événement;Date;Lieu' } : { heading: 'Guest book', fields: 'Event;Date;Place' } },
      { templateId: 'form', pages: 99, params: { perPage: 2, boxed: true, fields: fr(l) ? [f('De la part de'), f('Message', 'lines', { lines: 6 })] : [f('From'), f('Message', 'lines', { lines: 6 })] } }],
  },
  {
    id: 'checklists-survival',
    name: 'Carnet survivaliste / prepper',
    description: 'Inventaire, checklists, contacts et notes (format sac).',
    match: ['survival', 'surviv', 'prepper', 'bushcraft'],
    format: { trimId: '5.5x8.5', ink: 'bw-white' },
    sections: (l) => [owner(l),
      { templateId: 'table', pages: 8, params: fr(l) ? { title: 'Inventaire', rows: 22, columns: cols(['Objet', 3], ['Qté', 0.8], ['Lieu', 1.6], ['Péremption', 1.4]) } : { title: 'Inventory', rows: 22, columns: cols(['Item', 3], ['Qty', 0.8], ['Location', 1.6], ['Expiry', 1.4]) } },
      { templateId: 'checklist', pages: 8, params: { title: 'Checklist {n}' } },
      { templateId: 'form', pages: 4, params: { perPage: 4, fields: fr(l) ? [f('Nom'), f('Téléphone', 'line', { half: true }), f('Lieu', 'line', { half: true })] : [f('Name'), f('Phone', 'line', { half: true }), f('Place', 'line', { half: true })] } },
      { templateId: 'lined', pages: 79 }],
  },
  {
    id: 'gun-inventory',
    name: 'Gun inventory log',
    description: 'Registre des armes (marché US).',
    match: ['gun', 'firearm'],
    format: { trimId: '6x9', ink: 'bw-white' },
    sections: () => [{ templateId: 'form', pages: 100, params: { perPage: 2, boxed: true, fields: [f('Make', 'line', { half: true }), f('Model', 'line', { half: true }), f('Serial #', 'line', { half: true }), f('Caliber', 'line', { half: true }), f('Purchase date', 'line', { half: true }), f('Price', 'line', { half: true }), f('Purchased from'), f('Notes', 'lines', { lines: 2 })] } }],
  },
];

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export const findPreset = (id: string) => PRESETS.find((p) => p.id === id) ?? null;

/** Choisit le préréglage dont les mots déclencheurs couvrent le plus de texte (somme des longueurs trouvées). */
export function matchPreset(...texts: string[]): Preset | null {
  const hay = normalize(texts.join(' | '));
  let best: { p: Preset; score: number } | null = null;
  for (const p of PRESETS) {
    const score = p.match.filter((m) => hay.includes(m)).reduce((s, m) => s + m.length, 0);
    if (score > 0 && (!best || score > best.score)) best = { p, score };
  }
  return best?.p ?? null;
}

export function instantiateSections(preset: Preset, lang: Lang): Section[] {
  return preset.sections(lang).map((s) => ({
    id: uid('s'),
    name: s.name,
    templateId: s.templateId,
    pages: s.pages,
    params: structuredClone(s.params ?? {}),
    alt: s.alt ? { templateId: s.alt.templateId, params: structuredClone(s.alt.params ?? {}) } : null,
  }));
}
