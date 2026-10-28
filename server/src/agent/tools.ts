import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { z } from 'zod';
import {
  applyPalette, applyStyle, contrastRatio, COVER_STYLES, coverGeometry, coverTexts, estimateLines, findTemplate, findTrim, FONTS, INKS,
  instantiateSections, lintBook, MARKETPLACES, PALETTES, PATTERNS, PRESETS, pageRange, sanitizeDescription, TEMPLATES, totalPages, TRIM_SIZES,
  uid, type AgentEvent, type AgentScope, type Area, type Asset, type Book, type Idea, type Params,
} from '@shared';
import { generateIllustration, imagesAvailable, type ImageAspect } from './images';
import { makeTool } from './tooling';

export interface ToolContext {
  draft: Book;
  idea: Idea | null;
  scope: Set<AgentScope>;
  images: boolean;
  assets: () => Record<string, Asset>;
  emit: (e: AgentEvent) => void;
  signal?: AbortSignal;
}

const ids = <T extends { id: string }>(list: readonly T[]) => list.map((x) => x.id) as [string, ...string[]];
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'couleur hexadécimale #rrggbb');
const fontEnum = z.enum(FONTS.map((f) => f.family) as [string, ...string[]]);
const textStyle = z.object({
  font: fontEnum.optional(),
  size: z.number().min(6).max(120).optional(),
  weight: z.number().int().min(100).max(900).optional(),
  italic: z.boolean().optional(),
  color: hex.optional(),
  uppercase: z.boolean().optional(),
  letterSpacing: z.number().min(0).max(10).optional(),
});
const paramsSchema = z.record(z.string(), z.unknown()).describe('Paramètres du modèle de page (voir le catalogue) ; omis = valeurs par défaut');

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
const json = (v: unknown) => JSON.stringify(v);

function issues(ctx: ToolContext, areas: Area[] | null) {
  return lintBook(ctx.draft, ctx.assets())
    .filter((i) => !areas || areas.includes(i.area))
    .map((i) => ({ niveau: i.level, domaine: i.area, message: i.message }));
}

function sectionsSummary(b: Book) {
  return b.interior.sections.map((s, i) => ({
    index: i, name: s.name ?? null, templateId: s.templateId, pages: s.pages, params: s.params,
    alt: s.alt ? { templateId: s.alt.templateId, params: s.alt.params } : null,
  }));
}

function pagesInfo(b: Book) {
  const pages = totalPages(b);
  const range = pageRange(b.format.trimId, b.format.ink, b.format.binding);
  return { pages, plageAutorisee: range, formatCoupe: findTrim(b.format.trimId).label };
}

export function coverMetrics(b: Book) {
  const pages = totalPages(b);
  const geo = coverGeometry(b.format, pages);
  const c = b.cover;
  const onBlock = ['label', 'band', 'circle'].includes(c.titleBlock.style);
  const bg = onBlock ? c.titleBlock.fill : c.background.type === 'image' ? null : c.background.color;
  const tx = coverTexts(b);
  const innerW = (c.titleBlock.style === 'band' ? geo.safeFront.w : Math.min(geo.safeFront.w, c.titleBlock.width * geo.front.w)) - 32;
  return {
    titreAffiche: tx.title,
    contrasteTitre: bg ? Math.round(contrastRatio(c.title.color, bg) * 10) / 10 : 'fond image : vérifier visuellement',
    lignesTitreEstimees: estimateLines(tx.title, c.title, innerW),
    corpsTitrePt: c.title.size,
    texteDosAutorise: geo.spineTextAllowed,
    dosPouces: Math.round(geo.spineIn * 1000) / 1000,
    couvertureComplete: `${geo.widthIn.toFixed(3)} × ${geo.heightIn.toFixed(3)} in`,
  };
}

export function bookSnapshot(ctx: ToolContext) {
  const b = ctx.draft;
  const i = ctx.idea;
  return {
    fiche: b.metadata,
    format: { ...b.format, ...pagesInfo(b) },
    sections: sectionsSummary(b),
    couverture: b.cover,
    metriquesCouverture: coverMetrics(b),
    ideeSource: i
      ? {
          categorie: i.category, niche: i.niche, langue: i.language, titres: i.titles, sousTitre: i.subtitle,
          description: clip(i.description, 1500), categories: i.categories, motsCles: i.keywords,
          notes: i.notes.slice(0, 10).map((n) => clip(n, 400)), liens: i.links.slice(0, 5), traductions: i.translations,
        }
      : null,
    publie: b.status === 'publie' ? { asin: b.kdp?.asin ?? null, lien: b.kdp?.url ?? null } : null,
    domainesModifiables: [...ctx.scope],
  };
}

export function createTools(ctx: ToolContext): BetaRunnableTool<any>[] {
  const tools: BetaRunnableTool<any>[] = [];
  const b = () => ctx.draft;

  tools.push(makeTool(ctx.emit, 'read_book', 'Lecture du livre', 'Renvoie l\'état complet du brouillon : fiche KDP, format, sections d\'intérieur, couverture, métriques et idée source.', z.object({}), () => bookSnapshot(ctx)));

  if (ctx.scope.has('listing')) {
    tools.push(makeTool(ctx.emit, 'update_listing', 'Rédaction de la fiche KDP',
      'Met à jour la fiche produit KDP (seuls les champs fournis changent). Les mots-clés remplacent les 7 cases ; les catégories remplacent les 3 cases. La description est nettoyée vers les balises autorisées. Renvoie les contrôles de la fiche.',
      z.object({
        title: z.string().optional(),
        subtitle: z.string().optional(),
        author: z.string().optional().describe('Nom d\'auteur, pseudonyme ou marque éditoriale'),
        audience: z.string().optional().describe('Public visé, en une expression'),
        descriptionHtml: z.string().optional(),
        keywords: z.array(z.string()).max(7).optional(),
        categories: z.array(z.string()).max(3).optional(),
        price: z.number().positive().max(250).optional(),
        language: z.enum(['fr', 'en', 'de', 'es', 'it']).optional(),
        marketplace: z.enum(MARKETPLACES.map((m) => m.id) as [string, ...string[]]).optional(),
      }),
      (input) => {
        const m = b().metadata;
        const notes: string[] = [];
        for (const k of ['title', 'subtitle', 'author', 'audience', 'language', 'marketplace'] as const) if (input[k] !== undefined) (m as unknown as Record<string, unknown>)[k] = typeof input[k] === 'string' ? (input[k] as string).trim() : input[k];
        if (input.price !== undefined) m.price = Math.round(input.price * 100) / 100;
        if (input.keywords) m.keywords = [...input.keywords.map((k) => k.trim()), '', '', '', '', '', '', ''].slice(0, 7);
        if (input.categories) m.categories = [...input.categories.map((c) => c.trim()), '', '', ''].slice(0, 3);
        if (input.descriptionHtml !== undefined) {
          const clean = sanitizeDescription(input.descriptionHtml);
          if (clean !== input.descriptionHtml.trim()) notes.push('Balises non autorisées retirées ou converties dans la description.');
          m.descriptionHtml = clean;
        }
        return { ok: true, notes, longueurs: { titreEtSousTitre: m.title.length + m.subtitle.length, description: m.descriptionHtml.length, motsCles: m.keywords.map((k) => k.length) }, controles: issues(ctx, ['titre', 'mots-cles', 'description', 'categories', 'prix', 'conformite']) };
      }));
  }

  if (ctx.scope.has('interior')) {
    tools.push(makeTool(ctx.emit, 'set_format', 'Choix du format',
      'Change le format de coupe, le papier/encre, le fond perdu ou la finition (broché).',
      z.object({
        trimId: z.enum(TRIM_SIZES.filter((t) => t.bindings.includes('paperback')).map((t) => t.id) as [string, ...string[]]).optional(),
        ink: z.enum(ids(INKS)).optional(),
        bleed: z.boolean().optional(),
        finish: z.enum(['matte', 'glossy']).optional(),
      }),
      (input) => {
        const f = b().format;
        Object.assign(f, Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)));
        f.binding = 'paperback';
        if (!pageRange(f.trimId, f.ink, f.binding)) throw new Error(`Le format ${f.trimId} n'existe pas avec l'encre ${f.ink}.`);
        return { format: f, ...pagesInfo(b()), controles: issues(ctx, ['interieur']) };
      }));

    tools.push(makeTool(ctx.emit, 'apply_interior_preset', 'Préréglage d\'intérieur',
      'Remplace toutes les sections par un préréglage de niche du catalogue et applique son format conseillé.',
      z.object({ presetId: z.enum(ids(PRESETS)) }),
      ({ presetId }) => {
        const p = PRESETS.find((x) => x.id === presetId)!;
        b().interior.sections = instantiateSections(p, b().metadata.language);
        b().presetId = p.id;
        Object.assign(b().format, p.format);
        return { sections: sectionsSummary(b()), ...pagesInfo(b()), controles: issues(ctx, ['interieur']) };
      }));

    const templateEnum = z.enum(ids(TEMPLATES));
    tools.push(makeTool(ctx.emit, 'set_interior_sections', 'Composition de l\'intérieur',
      'Remplace toutes les sections de l\'intérieur. Chaque section répète un modèle de page ; « alt » applique un autre modèle aux pages de gauche (double page différenciée).',
      z.object({
        sections: z.array(z.object({
          name: z.string().optional(),
          templateId: templateEnum,
          pages: z.number().int().min(1).max(828),
          params: paramsSchema.optional(),
          alt: z.object({ templateId: templateEnum, params: paramsSchema.optional() }).nullable().optional(),
        })).min(1).max(60),
      }),
      ({ sections }) => {
        const check = (templateId: string, params: Record<string, unknown> | undefined, where: string) => {
          const allowed = findTemplate(templateId).params.map((p) => p.key);
          const unknown = Object.keys(params ?? {}).filter((k) => !allowed.includes(k));
          if (unknown.length) throw new Error(`${where} : paramètres inconnus pour « ${templateId} » : ${unknown.join(', ')}. Autorisés : ${allowed.join(', ')}.`);
        };
        sections.forEach((s, i) => {
          check(s.templateId, s.params, `Section ${i + 1}`);
          if (s.alt) check(s.alt.templateId, s.alt.params, `Section ${i + 1} (pages de gauche)`);
        });
        b().interior.sections = sections.map((s) => ({
          id: uid('s'), name: s.name, templateId: s.templateId, pages: s.pages, params: (s.params ?? {}) as Params,
          alt: s.alt ? { templateId: s.alt.templateId, params: (s.alt.params ?? {}) as Params } : null,
        }));
        b().presetId = null;
        return { sections: sectionsSummary(b()), ...pagesInfo(b()), controles: issues(ctx, ['interieur']) };
      }));
  }

  if (ctx.scope.has('cover')) {
    tools.push(makeTool(ctx.emit, 'design_cover', 'Design de la couverture',
      'Compose la couverture. Ordre d\'application : styleId (mise en page de départ), puis paletteId (couleurs), puis les réglages fins fournis. Les textes titre/sous-titre/auteur viennent de la fiche KDP ; backText est le texte facultatif de la 4e de couverture.',
      z.object({
        styleId: z.enum(ids(COVER_STYLES)).optional(),
        paletteId: z.enum(ids(PALETTES)).optional(),
        background: z.object({ type: z.enum(['solid', 'gradient', 'image']).optional(), color: hex.optional(), color2: hex.optional(), gradientAngle: z.number().min(0).max(360).optional() }).optional(),
        pattern: z.object({ id: z.enum(PATTERNS.map((p) => p.id) as [string, ...string[]]).optional(), color: hex.optional(), scale: z.number().min(0.4).max(3).optional(), opacity: z.number().min(0.05).max(1).optional(), frontOnly: z.boolean().optional() }).optional(),
        titleBlock: z.object({ style: z.enum(['plain', 'label', 'band', 'frame', 'circle']).optional(), position: z.number().min(0.1).max(0.9).optional(), fill: hex.optional(), border: hex.optional(), width: z.number().min(0.4).max(1).optional() }).optional(),
        title: textStyle.optional(),
        subtitle: textStyle.extend({ show: z.boolean().optional() }).optional(),
        author: textStyle.extend({ show: z.boolean().optional(), position: z.enum(['top', 'bottom']).optional() }).optional(),
        spine: z.object({ show: z.boolean().optional(), text: z.string().optional(), direction: z.enum(['top-bottom', 'bottom-top']).optional(), color: hex.optional(), background: hex.nullable().optional(), size: z.number().min(5).max(30).optional(), font: fontEnum.optional() }).optional(),
        back: textStyle.extend({ show: z.boolean().optional(), align: z.enum(['left', 'center']).optional() }).optional(),
        backText: z.string().max(600).optional(),
        stitch: z.object({ show: z.boolean().optional(), color: hex.optional() }).optional(),
        frontImage: z.object({ x: z.number().min(0).max(1).optional(), y: z.number().min(0).max(1).optional(), w: z.number().min(0.05).max(1).optional(), h: z.number().min(0.05).max(1).optional(), fit: z.enum(['cover', 'contain']).optional() }).optional(),
      }),
      (input) => {
        let c = b().cover;
        if (input.styleId) c = applyStyle(c, input.styleId);
        if (input.paletteId) c = applyPalette(c, PALETTES.find((p) => p.id === input.paletteId)!);
        const merge = <T extends object>(target: T, patch: object | undefined): T => (patch ? { ...target, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) } : target);
        c = {
          ...c,
          background: merge(c.background, input.background),
          pattern: merge(c.pattern, input.pattern) as typeof c.pattern,
          titleBlock: merge(c.titleBlock, input.titleBlock),
          title: merge(c.title, input.title),
          subtitle: merge(c.subtitle, input.subtitle),
          author: merge(c.author, input.author),
          spine: merge(c.spine, input.spine),
          back: merge(c.back, input.back),
          stitch: merge(c.stitch, input.stitch),
          frontImage: merge(c.frontImage, input.frontImage),
          texts: { ...c.texts, title: '', subtitle: '', author: '', back: input.backText ?? c.texts.back },
        };
        if (input.backText !== undefined) c.back = { ...c.back, show: !!input.backText.trim() };
        if (c.background.type === 'image' && !c.background.imageId) throw new Error('Fond « image » demandé sans image : génère d\'abord une illustration (placement background) ou garde un fond uni/dégradé.');
        b().cover = c;
        return { metriques: coverMetrics(b()), controles: issues(ctx, ['couverture']) };
      }));

    if (ctx.images && imagesAvailable()) {
      tools.push(makeTool(ctx.emit, 'generate_illustration', 'Génération de l\'illustration',
        'Génère une illustration avec un modèle d\'image Gemini et la place sur la couverture : « front » = illustration de la 1re de couverture (zone frontImage), « background » = fond pleine couverture (4e + dos + 1re). Prompt en anglais, sans texte ni marque. Coche automatiquement la déclaration IA (images).',
        z.object({
          prompt: z.string().min(20).max(1500),
          placement: z.enum(['front', 'background']),
          aspectRatio: z.enum(['2:3', '3:4', '4:5', '1:1', '4:3', '3:2']).optional(),
        }),
        async ({ prompt, placement, aspectRatio }) => {
          const geo = coverGeometry(b().format, totalPages(b()));
          const fi = b().cover.frontImage;
          const ratio = placement === 'background' ? geo.width / geo.height : (fi.w * geo.front.w) / (fi.h * geo.front.h);
          const options: [ImageAspect, number][] = [['2:3', 2 / 3], ['3:4', 0.75], ['4:5', 0.8], ['1:1', 1], ['4:3', 4 / 3], ['3:2', 1.5]];
          const aspect = aspectRatio ?? options.reduce((best, o) => (Math.abs(o[1] - ratio) < Math.abs(best[1] - ratio) ? o : best))[0];
          const asset = await generateIllustration(prompt, aspect as ImageAspect, placement === 'background' ? '4K' : '2K', ctx.signal);
          ctx.emit({ type: 'asset', asset });
          const c = b().cover;
          if (placement === 'background') b().cover = { ...c, background: { ...c.background, type: 'image', imageId: asset.id } };
          else b().cover = { ...c, frontImage: { ...c.frontImage, imageId: asset.id } };
          b().metadata.aiGenerated.images = true;
          const target = placement === 'background' ? { w: geo.width, h: geo.height } : { w: fi.w * geo.front.w, h: fi.h * geo.front.h };
          const dpi = Math.round(Math.min(asset.width / (target.w / 72), asset.height / (target.h / 72)));
          return { asset: { id: asset.id, largeur: asset.width, hauteur: asset.height, ratio: aspect }, dpiEffectifs: dpi, declarationIaImages: true, controles: issues(ctx, ['couverture']) };
        }));
    }
  }

  tools.push(makeTool(ctx.emit, 'check_book', 'Contrôle KDP',
    'Contrôle complet du brouillon (règles KDP, prix, intérieur, couverture) et métriques de couverture. À appeler après les modifications, jusqu\'à zéro erreur.',
    z.object({}),
    () => {
      const all = issues(ctx, null);
      return {
        erreurs: all.filter((i) => i.niveau === 'error'),
        avertissements: all.filter((i) => i.niveau === 'warning'),
        conseils: all.filter((i) => i.niveau === 'info').map((i) => i.message),
        ...pagesInfo(b()),
        metriquesCouverture: coverMetrics(b()),
      };
    }));

  return tools;
}
