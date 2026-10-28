// Adresse du serveur Node (API, PDF, polices, images, agent).
// En local l'interface et l'API partagent l'origine ; sur Firebase Hosting l'API reste sur ton poste.
const KEY = 'bc.apiBase';

export const isHosted = () => /\.(web\.app|firebaseapp\.com)$/.test(location.hostname);

export function apiBase(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) return saved.replace(/\/+$/, '');
  } catch {
    /* stockage indisponible : valeur par défaut */
  }
  return isHosted() ? 'http://localhost:3000' : '';
}

export function setApiBase(url: string): void {
  try {
    if (url.trim()) localStorage.setItem(KEY, url.trim());
    else localStorage.removeItem(KEY);
  } catch {
    /* ignoré */
  }
}

export const apiUrl = (path: string) => apiBase() + path;
