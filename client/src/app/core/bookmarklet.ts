import { bookCreatorFavori } from './favori';

// Favori « Book Creator » : la fonction bookCreatorFavori (favori.ts) est sérialisée telle que compilée,
// puis appelée avec l'adresse de l'app. Il lit uniquement la page ouverte ; l'analyse se fait dans l'app.
export function bookmarkletHref(appOrigin: string): string {
  const code = `(${bookCreatorFavori.toString()})(${JSON.stringify(appOrigin)});`;
  return `javascript:${encodeURIComponent(code)}`;
}

/** Origines acceptées par la page relais /capture. */
export const AMAZON_ORIGIN = /^https:\/\/www\.amazon\.(fr|com|de|es|it)$/;
export const KDP_ORIGIN = 'https://kdp.amazon.com';
