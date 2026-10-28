import type { Lang } from '../i18n';
import { findTrim } from '../kdp/specs';
import type { Book, Section } from '../model';
import { totalPages } from '../interior/layout';
import type { ColumnDef, FieldDef } from '../interior/kit';
import { findTemplate } from '../interior/templates';

type L = 'fr' | 'en';
const lg = (lang: Lang): L => (lang === 'fr' ? 'fr' : 'en');

function describeTemplate(templateId: string, params: Record<string, unknown>, n: number, l: L): string {
  const p = params ?? {};
  const fr = l === 'fr';
  switch (templateId) {
    case 'title-page': return fr ? 'Une page de présentation « Ce carnet appartient à »' : 'A "This notebook belongs to" page';
    case 'lined': return fr ? `${n} pages lignées${p['numbered'] ? ' à lignes numérotées' : ''}` : `${n} lined pages${p['numbered'] ? ' with numbered lines' : ''}`;
    case 'dotted': return fr ? `${n} pages en pointillés (dot grid)` : `${n} dot grid pages`;
    case 'grid': return fr ? `${n} pages quadrillées` : `${n} graph paper pages`;
    case 'seyes': return fr ? `${n} pages Seyès grands carreaux` : `${n} French-ruled (Seyès) pages`;
    case 'blank': return fr ? `${n} pages vierges${p['frame'] && p['frame'] !== 'none' ? ' encadrées' : ''}` : `${n} blank${p['frame'] && p['frame'] !== 'none' ? ' framed' : ''} pages`;
    case 'comic': return p['layout'] === 'varie' || !p['layout']
      ? (fr ? `${n} planches de bande dessinée toutes différentes` : `${n} unique comic book page layouts`)
      : (fr ? `${n} planches de bande dessinée` : `${n} comic book pages`);
    case 'music': return fr ? `${n} pages de portées musicales` : `${n} pages of music staff paper`;
    case 'tablature': return fr ? `${n} pages de tablatures avec diagrammes d'accords` : `${n} pages of guitar tabs with chord charts`;
    case 'handwriting': return fr ? `${n} pages d'écriture avec cadre de dessin et ligne médiane pointillée` : `${n} draw & write pages with dotted midline`;
    case 'checklist': return p['maxItems'] ? (fr ? `Une liste de ${p['maxItems']} idées numérotées à cocher` : `A numbered checklist of ${p['maxItems']} ideas`) : (fr ? `${n} pages de checklists` : `${n} checklist pages`);
    case 'coupons': {
      const per = (Number(p['rows'] ?? 4) || 4) * (p['cols'] === '2' ? 2 : 1);
      return fr ? `${n * per} bons à découper` : `${n * per} cut-out coupons`;
    }
    case 'weekly': return fr ? `${n} semaines à remplir (une page par semaine)` : `${n} undated weekly pages`;
    case 'monthly': return fr ? `${n} pages de calendrier mensuel non daté` : `${n} undated monthly calendar pages`;
    case 'table': {
      const cols = (Array.isArray(p['columns']) ? (p['columns'] as ColumnDef[]) : []).map((c) => c.label.toLowerCase()).filter(Boolean);
      const rows = p['rows'] ?? 25;
      return fr ? `${n} pages de tableau de ${rows} lignes${cols.length ? ` : ${cols.join(', ')}` : ''}` : `${n} pages of ${rows}-row tables${cols.length ? `: ${cols.join(', ')}` : ''}`;
    }
    case 'form': {
      const per = Number(p['perPage'] ?? 1) || 1;
      const fields = (Array.isArray(p['fields']) ? (p['fields'] as FieldDef[]) : []).map((f) => f.label.toLowerCase()).filter(Boolean);
      return fr ? `${n * per} fiches à remplir${fields.length ? ` (${fields.join(', ')})` : ''}` : `${n * per} fill-in pages${fields.length ? ` (${fields.join(', ')})` : ''}`;
    }
    default: return `${n} ${findTemplate(templateId).name.toLowerCase()}`;
  }
}

export function describeSection(s: Section, lang: Lang): string {
  const l = lg(lang);
  if (s.alt) {
    const spreads = Math.floor(s.pages / 2);
    const right = describeTemplate(s.templateId, s.params, spreads, l);
    const left = describeTemplate(s.alt.templateId, s.alt.params, spreads, l);
    return l === 'fr' ? `${spreads} doubles pages : ${left.replace(/^\d+ /, '')} à gauche, ${right.replace(/^\d+ /, '')} à droite` : `${spreads} spreads: ${left.replace(/^\d+ /, '')} on the left, ${right.replace(/^\d+ /, '')} on the right`;
  }
  const d = describeTemplate(s.templateId, s.params, s.pages, l);
  return s.name && !['lined', 'title-page'].includes(s.templateId) ? `${s.name} : ${d}` : s.name && s.templateId === 'lined' ? `${d} (${s.name.toLowerCase()})` : d;
}

export function productDetails(book: Book): string[] {
  const l = lg(book.metadata.language);
  const t = findTrim(book.format.trimId);
  const pages = totalPages(book);
  const fr = l === 'fr';
  const color = book.format.ink.includes('color');
  const paper = book.format.ink === 'bw-cream' ? (fr ? 'crème' : 'cream') : (fr ? 'blanc' : 'white');
  const fmt = fr ? `Format ${t.cm.replace(/\./g, ',')} (${t.w} × ${t.h} pouces)` : `${t.w} × ${t.h} inches (${t.cm})`;
  return [
    fmt,
    fr ? `${pages} pages` : `${pages} pages`,
    book.format.binding === 'hardcover'
      ? (fr ? 'Couverture rigide' : 'Hardcover')
      : fr ? `Couverture souple au fini ${book.format.finish === 'glossy' ? 'brillant' : 'mat'}` : `${book.format.finish === 'glossy' ? 'Glossy' : 'Matte'} paperback cover`,
    color ? (fr ? `Intérieur couleur sur papier ${paper}` : `Color interior on ${paper} paper`) : (fr ? `Intérieur noir et blanc sur papier ${paper}` : `Black & white interior on ${paper} paper`),
  ];
}

/** Génère une description HTML conforme aux balises KDP, dans le style des fiches existantes. */
export function generateDescription(book: Book): string {
  const m = book.metadata;
  const l = lg(m.language);
  const fr = l === 'fr';
  const audience = m.audience.trim();
  const hook = audience
    ? fr ? `Le cadeau idéal pour ${audience}.` : `The perfect gift for ${audience}.`
    : `${m.title}${m.subtitle ? ` — ${m.subtitle}` : ''}`;
  const items = book.interior.sections.filter((s) => s.pages > 0).map((s) => describeSection(s, m.language));
  const parts = [
    `<h4>${hook}</h4>`,
    m.subtitle && audience ? `<p>${m.subtitle}</p>` : '',
    `<p><b>${fr ? 'Ce carnet contient :' : 'Inside this book:'}</b></p>`,
    `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`,
    `<p><b>${fr ? 'Caractéristiques :' : 'Details:'}</b></p>`,
    `<ul>${productDetails(book).map((d) => `<li>${d}</li>`).join('')}</ul>`,
    `<p>${fr ? 'Découvrez les autres modèles et couleurs de la collection en cliquant sur le nom de l\'auteur.' : 'Discover more designs and colors from this collection by clicking the author name.'}</p>`,
  ];
  return parts.filter(Boolean).join('\n');
}
