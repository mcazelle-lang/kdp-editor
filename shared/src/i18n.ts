export type Lang = 'fr' | 'en' | 'de' | 'es' | 'it';

export const LANGS: { value: Lang; label: string }[] = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'it', label: 'Italiano' },
];

type Dict = Partial<Record<Lang, string>> & { fr: string; en: string };

const WORDS = {
  date: { fr: 'Date', en: 'Date', de: 'Datum', es: 'Fecha', it: 'Data' },
  title: { fr: 'Titre', en: 'Title', de: 'Titel', es: 'Título', it: 'Titolo' },
  notes: { fr: 'Notes', en: 'Notes', de: 'Notizen', es: 'Notas', it: 'Note' },
  weekOf: { fr: 'Semaine du', en: 'Week of', de: 'Woche vom', es: 'Semana del', it: 'Settimana del' },
  month: { fr: 'Mois', en: 'Month', de: 'Monat', es: 'Mes', it: 'Mese' },
  year: { fr: 'Année', en: 'Year', de: 'Jahr', es: 'Año', it: 'Anno' },
  total: { fr: 'Total', en: 'Total', de: 'Summe', es: 'Total', it: 'Totale' },
  carried: { fr: 'Report', en: 'Brought forward', de: 'Übertrag', es: 'Saldo anterior', it: 'Riporto' },
  belongsTo: { fr: 'Ce carnet appartient à', en: 'This notebook belongs to', de: 'Dieses Notizbuch gehört', es: 'Este cuaderno pertenece a', it: 'Questo quaderno appartiene a' },
  stickHere: { fr: 'Collez votre spécimen ici', en: 'Place your specimen here', de: 'Exemplar hier einkleben', es: 'Pegue su espécimen aquí', it: 'Incolla qui il tuo esemplare' },
} satisfies Record<string, Dict>;

export type WordKey = keyof typeof WORDS;

export function t(key: WordKey, lang: Lang): string {
  const d: Dict = WORDS[key];
  return d[lang] ?? d.en;
}

export const DAYS: Record<Lang, string[]> = {
  fr: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  de: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
  es: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
  it: ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'],
};
