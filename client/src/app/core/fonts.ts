import { FONTS } from '@shared';
import { apiUrl } from './api-base';

/** Déclare les @font-face des polices embarquées dans les PDF (servies par le serveur sur /fonts). */
export function installFonts(): void {
  const rules: string[] = [];
  for (const f of FONTS) {
    for (const w of f.weights) {
      for (const style of f.italic ? ['normal', 'italic'] : ['normal']) {
        const base = apiUrl(`/fonts/${f.pkg}/${f.pkg}-latin-${w}-${style}`);
        rules.push(`@font-face{font-family:'${f.family}';font-style:${style};font-weight:${w};font-display:swap;src:url('${base}.woff2') format('woff2'),url('${base}.woff') format('woff');}`);
      }
    }
  }
  const el = document.createElement('style');
  el.id = 'kdp-fonts';
  el.textContent = rules.join('\n');
  document.head.appendChild(el);
}
