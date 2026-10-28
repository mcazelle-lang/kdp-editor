/* eslint-disable */
// Code du favori « Book Creator », exécuté DANS la page ouverte par la personne (Amazon ou KDP).
// Il est sérialisé avec Function.prototype.toString : il doit rester autonome (aucune variable ni import extérieurs).
// Pas de décomposition d'objet ({ ...x }) : le build la remplace par des fonctions utilitaires extérieures à la fonction.
//  - www.amazon.* : capture la page de résultats ou la fiche produit (radar de niches) ;
//  - kdp.amazon.com (Bibliothèque, Rapports) : capture le texte autour de chaque ASIN/ISBN (catalogue, ventes) ;
//  - kdp.amazon.com/…/title-setup/… : remplit le formulaire avec le livre préparé dans l'app ; la personne vérifie et publie.
export function bookCreatorFavori(APP: string): void {
  const d = document;
  const L = location;
  const t = (e: Element | null | undefined): string => (e ? ((e as HTMLElement).innerText || e.textContent || '').trim() : '');

  function relay(): Window | null {
    const w = window.open('', 'bc-capture');
    if (!w) {
      alert('Book Creator : autorise les fenêtres pop-up pour ce site.');
      return null;
    }
    let fresh = false;
    try {
      fresh = w.location.href === 'about:blank';
    } catch (e) {
      /* onglet de l'app déjà ouvert (autre origine) */
    }
    if (fresh) w.location.href = APP + '/capture';
    return w;
  }

  function sendCapture(p: { capturedAt: string }): void {
    const w = relay();
    if (!w) return;
    let n = 0;
    const iv = setInterval(() => {
      if (++n > 50) return clearInterval(iv);
      try {
        w.postMessage({ bookCreator: p }, APP);
      } catch (e) {
        /* fenêtre pas encore prête */
      }
    }, 300);
    window.addEventListener('message', (e) => {
      if (e.origin === APP && e.data && e.data.bookCreatorAck === p.capturedAt) clearInterval(iv);
    });
  }

  const base = { v: 1, url: L.href, host: L.hostname, lang: d.documentElement.lang || '', capturedAt: new Date().toISOString() };

  // ------------------------------------------------------------ Amazon (radar de niches)
  if (/^www\.amazon\./.test(L.hostname)) {
    const p: Record<string, unknown> = Object.assign({}, base);
    let cards: Element[] = Array.from(d.querySelectorAll('[data-component-type="s-search-result"][data-asin]'));
    if (!cards.length) cards = Array.from(d.querySelectorAll('div[data-asin]:not([data-asin=""]) h2')).map((h) => h.closest('[data-asin]')!).filter(Boolean);
    if (cards.length && /\/s(\?|$)/.test(L.pathname + L.search)) {
      p['kind'] = 'serp';
      p['resultInfo'] = t(d.querySelector('[data-component-type="s-result-info-bar"]')) || t(d.querySelector('.s-breadcrumb'));
      p['cards'] = cards.slice(0, 60).map((c) => ({
        asin: c.getAttribute('data-asin') || '',
        text: t(c).slice(0, 900),
        title: t(c.querySelector('h2')).slice(0, 300),
        labels: Array.from(c.querySelectorAll('[aria-label]')).map((e) => e.getAttribute('aria-label') || '').slice(0, 20),
        sponsored: !!c.querySelector('.puis-sponsored-label-text, .s-sponsored-label-text, .s-sponsored-label-info-icon') || /AdHolder/.test(c.className),
        img: (c.querySelector('img.s-image') as HTMLImageElement | null)?.src || '',
      }));
    } else if (d.getElementById('productTitle')) {
      p['kind'] = 'product';
      const m = L.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
      p['asin'] = m ? m[1] : (d.getElementById('ASIN') as HTMLInputElement | null)?.value || '';
      p['title'] = t(d.getElementById('productTitle'));
      p['details'] = ['#detailBulletsWrapper_feature_div', '#detailBullets_feature_div', '#productDetails_feature_div', '#prodDetails', '#richProductInformation_feature_div']
        .map((s) => t(d.querySelector(s))).join('\n\n').slice(0, 9000);
      p['price'] = t(d.querySelector('#tmmSwatches .a-button-selected')) || t(d.querySelector('#corePrice_feature_div .a-offscreen, #price, .a-price .a-offscreen'));
      const r = d.getElementById('acrPopover');
      p['rating'] = r ? r.getAttribute('title') || t(r) : '';
      p['reviews'] = t(d.getElementById('acrCustomerReviewText'));
    } else {
      alert('Book Creator : ouvre une page de résultats de recherche ou une fiche produit Amazon, puis clique à nouveau.');
      return;
    }
    sendCapture(p as { capturedAt: string });
    return;
  }

  if (L.hostname !== 'kdp.amazon.com') {
    alert('Book Creator : ce favori fonctionne sur Amazon (recherche, fiche produit) et sur kdp.amazon.com.');
    return;
  }

  // ------------------------------------------------------------ KDP : remplissage du formulaire de création
  if (/title-setup/.test(L.pathname)) {
    const w = relay();
    if (!w) return;
    const nonce = String(Date.now());
    const fileInputs = Array.from(d.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    let handled = false;
    const iv = setInterval(() => {
      try {
        w.postMessage({ bookCreatorFillRequest: nonce, files: fileInputs.length > 0 }, APP);
      } catch (e) {
        /* fenêtre pas encore prête */
      }
    }, 400);
    setTimeout(() => clearInterval(iv), 20000);
    window.addEventListener('message', (e) => {
      if (handled || e.origin !== APP || !e.data || e.data.nonce !== nonce) return;
      handled = true;
      clearInterval(iv);
      if (e.data.bookCreatorFillError) return alert('Book Creator : ' + e.data.bookCreatorFillError);
      fill(e.data.bookCreatorFill, e.data.files || {});
    });

    function fill(P: any, files: Record<string, ArrayBuffer>): void {
      const done: string[] = [];
      const todo: string[] = [];
      const visible = (el: Element | null): el is HTMLInputElement => !!el && (el as HTMLInputElement).type !== 'hidden' && !(el as HTMLInputElement).disabled;
      const setValue = (el: HTMLInputElement | HTMLTextAreaElement, v: string) => {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v);
        for (const ev of ['input', 'change', 'blur']) el.dispatchEvent(new Event(ev, { bubbles: true }));
      };
      const bySelectors = (sels: string[]) => sels.map((s) => d.querySelector(s)).find(visible) || null;
      const byLabel = (re: RegExp): HTMLInputElement | null => {
        for (const l of Array.from(d.querySelectorAll('label'))) {
          if (!re.test(t(l))) continue;
          const f = (l.htmlFor && d.getElementById(l.htmlFor)) || l.querySelector('input,textarea,select') || l.parentElement?.querySelector('input:not([type=hidden]),textarea,select');
          if (visible(f || null)) return f as HTMLInputElement;
        }
        return null;
      };
      const text = (name: string, value: string, sels: string[], re: RegExp) => {
        if (!value) return;
        const el = bySelectors(sels) || byLabel(re);
        if (el) {
          setValue(el, value);
          done.push(name);
        } else todo.push(name);
      };
      // Cases et boutons radio : label correspondant dans le bloc dont le texte correspond au groupe
      const choose = (name: string, groupRe: RegExp | null, optionRe: RegExp, wanted = true) => {
        const scope: ParentNode = groupRe
          ? (Array.from(d.querySelectorAll('fieldset, section, .a-section, .a-row, div'))
              .filter((g) => groupRe.test(t(g).slice(0, 400)) && g.querySelector('input[type=radio],input[type=checkbox]'))
              .sort((a, b) => t(a).length - t(b).length)[0] as ParentNode) || d
          : d;
        const inputs = Array.from(scope.querySelectorAll('input[type=radio],input[type=checkbox]')) as HTMLInputElement[];
        const target = inputs.find((i) => {
          const lab = (i.id && d.querySelector('label[for="' + i.id + '"]')) || i.closest('label') || i.parentElement;
          return optionRe.test(t(lab));
        });
        if (!target) {
          todo.push(name);
          return;
        }
        if (target.checked !== wanted) target.click();
        done.push(name);
      };

      const isDetails = !!(d.querySelector('#data-title, input[name="data[title]"]') || byLabel(/^(titre du livre|book title|buchtitel|título del libro|titolo del libro)/i));
      if (isDetails) {
        const langSel = (Array.from(d.querySelectorAll('select')) as HTMLSelectElement[]).find((s) => Array.from(s.options).some((o) => /fran[cç]ais|french|english|anglais/i.test(o.text)));
        if (langSel) {
          const opt = Array.from(langSel.options).find((o) => o.text.trim().toLowerCase().startsWith(String(P.languageLabel).toLowerCase()));
          if (opt) {
            langSel.value = opt.value;
            langSel.dispatchEvent(new Event('change', { bubbles: true }));
            done.push('Langue');
          } else todo.push('Langue');
        }
        text('Titre', P.title, ['#data-title', 'input[name="data[title]"]'], /^(titre du livre|book title|buchtitel|título del libro|titolo del libro)/i);
        text('Sous-titre', P.subtitle, ['#data-subtitle', 'input[name="data[subtitle]"]'], /^(sous-titre|subtitle|untertitel|subtítulo|sottotitolo)/i);
        text('Prénom', P.authorFirst, ['#data-primary-author-first-name', 'input[name="data[primary_author][first_name]"]'], /^(prénom|first name|vorname|nombre|nome)\b/i);
        text('Nom', P.authorLast, ['#data-primary-author-last-name', 'input[name="data[primary_author][last_name]"]'], /^(nom|last name|nachname|apellido|cognome)\b/i);
        // Description : éditeur riche (CKEditor) si présent, sinon zone de texte
        const ck = (window as any).CKEDITOR;
        const iframe = d.querySelector('iframe.cke_wysiwyg_frame') as HTMLIFrameElement | null;
        if (ck && ck.instances && Object.keys(ck.instances).length) {
          Object.keys(ck.instances).forEach((k) => ck.instances[k].setData(P.descriptionHtml));
          done.push('Description');
        } else if (iframe && iframe.contentDocument) {
          iframe.contentDocument.body.innerHTML = P.descriptionHtml;
          done.push('Description');
        } else text('Description', P.descriptionHtml, ['#data-description', 'textarea[name="data[description]"]'], /^(description|beschreibung|descripción|descrizione)/i);
        // 7 mots-clés
        let kw = (P.keywords as string[]).map((_, i) => bySelectors(['#data-keywords-' + i, 'input[name="data[keywords][' + i + ']"]']));
        if (!kw.some(Boolean)) {
          const head = Array.from(d.querySelectorAll('h1,h2,h3,h4,h5,label,span,legend')).find((h) => /^(mots-clés|keywords|schlüsselwörter|palabras clave|parole chiave)/i.test(t(h)));
          const scope = head?.closest('section, fieldset, .a-section, div') || null;
          kw = scope ? (Array.from(scope.querySelectorAll('input[type=text]')).slice(0, 7) as HTMLInputElement[]) : [];
        }
        let kwCount = 0;
        (P.keywords as string[]).forEach((k, i) => {
          if (k && kw[i]) {
            setValue(kw[i]!, k);
            kwCount++;
          }
        });
        if (kwCount) done.push(`Mots-clés (${kwCount})`);
        else if ((P.keywords as string[]).some(Boolean)) todo.push('Mots-clés');
        choose('Droits de publication', null, /(je (?:détiens|possède)|i own the copyright|ich besitze|tengo los derechos|possiedo il copyright)/i);
        choose('Contenu explicite : non', /(sexuellement explicite|sexually explicit|sexuell eindeutig|sexualmente explícit|sessualmente esplicit)/i, /^(non|no|nein)$/i);
        if (P.lowContent) choose('Livre low-content', null, /(low[- ]content|faible contenu|contenu (?:limité|minimal)|wenig inhalt|bajo contenido|basso contenuto)/i);
        todo.push('Catégories (3) : ' + (P.categories as string[]).join(' · '));
      }

      const isContent = fileInputs.length > 0 || !!d.querySelector('input[type=radio]') && /(fond perdu|bleed|anschnitt|sangrado|al vivo)/i.test(t(d.body).slice(0, 20000));
      if (!isDetails && isContent) {
        const inkRe: Record<string, RegExp> = {
          'bw-white': /(noir et blanc|black (?:&|and) white|schwarzweiß|blanco y negro|bianco e nero).*(blanc|white|weiß|blanco|bianca)/i,
          'bw-cream': /(noir et blanc|black (?:&|and) white|schwarzweiß|blanco y negro|bianco e nero).*(crème|cream|creme|crema)/i,
          'bw-groundwood': /groundwood/i,
          'std-color': /(couleur standard|standard colou?r|standardfarbe|color estándar|colore standard)/i,
          'premium-color': /(couleur premium|premium colou?r|premiumfarbe|color prémium|colore premium)/i,
        };
        choose('Encre et papier', /(encre et papier|ink (?:&|and) paper|tinte und papier|tinta y papel|inchiostro e carta)/i, inkRe[P.print.ink] || /$^/);
        choose('Fond perdu', /(fond perdu|bleed|anschnitt|sangrado|al vivo)/i, P.print.bleed ? /^(avec fond perdu|bleed|mit anschnitt|con sangrado|al vivo)/i : /^(sans fond perdu|no bleed|ohne anschnitt|sin sangrado|senza)/i);
        choose('Finition', /(finition|cover finish|oberfläche|acabado|finitura)/i, P.print.finish === 'glossy' ? /(brill|gloss|glänz|brillo|lucid)/i : /^(mat|matt)/i);
        todo.push('Format (taille de coupe) : ' + P.print.trim);
        if (P.aiGenerated.text || P.aiGenerated.images || P.aiGenerated.translation) todo.push('Déclaration IA : ' + ['texte', 'images', 'traduction'].filter((_, i) => [P.aiGenerated.text, P.aiGenerated.images, P.aiGenerated.translation][i]).join(', '));
        // Fichiers : manuscrit puis couverture, glissés dans les champs de téléversement de la page
        const put = (name: string, re: RegExp, buf: ArrayBuffer | undefined, file: string) => {
          const input = fileInputs.find((i) => re.test(t(i.closest('section, fieldset, .a-section, div') || i.parentElement)));
          if (!input || !buf) {
            todo.push(name);
            return;
          }
          try {
            const dt = new DataTransfer();
            dt.items.add(new File([buf], file, { type: 'application/pdf' }));
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            done.push(name);
          } catch (e) {
            todo.push(name);
          }
        };
        put('Manuscrit (PDF intérieur)', /(manuscrit|manuscript|manuskript|manuscrito|manoscritto|intérieur|interior)/i, files['interior'], 'interieur.pdf');
        put('Couverture (PDF)', /(couverture|cover|umschlag|cubierta|copertina)/i, files['cover'], 'couverture.pdf');
      }

      const priceInputs = Array.from(d.querySelectorAll('input')).filter((i) => /price|prix|preis|precio|prezzo/i.test(i.name + ' ' + i.id + ' ' + i.getAttribute('aria-label')));
      if (!isDetails && !isContent && priceInputs.length) {
        const row = Array.from(d.querySelectorAll('tr, .a-row, div')).filter((r) => r.textContent?.includes(P.marketplace) && r.querySelector('input')).sort((a, b) => t(a).length - t(b).length)[0];
        const input = (row?.querySelector('input:not([type=hidden])') as HTMLInputElement | null) || null;
        const fr = /^(fr|de|es|it)/i.test(d.documentElement.lang || '');
        if (input) {
          setValue(input, P.price.toFixed(2).replace('.', fr ? ',' : '.'));
          done.push(`Prix ${P.marketplace}`);
        } else todo.push(`Prix ${P.marketplace} : ${P.price}`);
      }

      // Panneau récapitulatif dans la page KDP, avec boutons de copie pour la saisie manuelle
      const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
      const copies: [string, string][] = [
        ['Titre', P.title], ['Sous-titre', P.subtitle], ['Auteur', (P.authorFirst + ' ' + P.authorLast).trim()], ['Description (HTML)', P.descriptionHtml],
        ...(P.keywords as string[]).map((k, i) => ['Mot-clé ' + (i + 1), k] as [string, string]),
        ...(P.categories as string[]).map((c, i) => ['Catégorie ' + (i + 1), c] as [string, string]),
        ['Prix', String(P.price)],
      ].filter((c) => c[1]) as [string, string][];
      d.getElementById('bc-panel')?.remove();
      const panel = d.createElement('div');
      panel.id = 'bc-panel';
      panel.setAttribute('style', 'position:fixed;right:16px;bottom:16px;width:360px;max-height:75vh;overflow:auto;z-index:2147483647;background:#fff;color:#1b2236;font:13px/1.45 system-ui,sans-serif;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.25);padding:14px 16px;border:2px solid #ef6c3e');
      panel.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:14px">Book Creator</b><button data-bc-close style="border:none;background:none;font-size:18px;cursor:pointer">×</button></div>' +
        (P.blocking.length ? '<div style="background:#fde3e7;color:#8d1d2e;border-radius:6px;padding:6px 8px;margin:6px 0"><b>Corrige d\'abord dans l\'app :</b><br>' + P.blocking.map(esc).join('<br>') + '</div>' : '') +
        '<div style="margin:6px 0"><b>Rempli :</b> ' + (done.length ? done.map(esc).join(', ') : 'rien sur cette page') + '</div>' +
        (todo.length ? '<div style="margin:6px 0"><b>À faire à la main :</b><br>' + todo.map(esc).join('<br>') + '</div>' : '') +
        '<div style="margin-top:8px;color:#6b7390">Copier :</div>' +
        copies.map((c, i) => '<button data-bc-copy="' + i + '" style="margin:3px 4px 0 0;border:1px solid #d3d8e6;background:#f5f6fa;border-radius:6px;padding:3px 7px;cursor:pointer">' + esc(c[0]) + '</button>').join('') +
        '<div style="margin-top:10px;color:#6b7390">Vérifie chaque champ, puis enregistre ou publie toi-même dans KDP.</div>';
      panel.addEventListener('click', (ev) => {
        const b = (ev.target as HTMLElement).closest('button');
        if (!b) return;
        if (b.hasAttribute('data-bc-close')) return panel.remove();
        const c = copies[Number(b.getAttribute('data-bc-copy'))];
        if (c) navigator.clipboard.writeText(c[1]).then(() => (b.textContent = '✓ ' + c[0]));
      });
      d.body.appendChild(panel);
    }
    return;
  }

  // ------------------------------------------------------------ KDP : capture (Bibliothèque, Rapports)
  const ID = /\b(B0[A-Z0-9]{8}|97[89][\d-]{10,14}|\d{9}[\dX])\b/g;
  const ladders: { id: string; texts: string[] }[] = [];
  const seen: Record<string, boolean> = {};
  const walker = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode()) && ladders.length < 600) {
    const ids = (node.nodeValue || '').match(ID);
    if (!ids) continue;
    for (const id of ids) {
      const texts: string[] = [];
      let el: Element | null = node.parentElement;
      let prev = 0;
      for (let i = 0; el && i < 12; i++, el = el.parentElement) {
        const tx = t(el);
        if (tx.length > prev) {
          texts.push(tx.slice(0, 4000));
          prev = tx.length;
        }
        if (tx.length > 8000) break;
      }
      /* un même ASIN peut revenir sur plusieurs lignes (une par place de marché) : on dédoublonne par ascendance */
      const key = id + '|' + texts.slice(1, 3).join('|');
      if (seen[key]) continue;
      seen[key] = true;
      ladders.push({ id, texts });
    }
  }
  const ID1 = new RegExp(ID.source);
  const rows = Array.from(d.querySelectorAll('tr, [role="row"]')).map((r) => t(r)).filter((x) => x.length < 3000 && ID1.test(x)).slice(0, 3000);
  const period = t(d.querySelector('[class*="date-range" i], [class*="daterange" i], [data-testid*="date" i], [aria-label*="période" i], [aria-label*="date range" i]'));
  sendCapture(Object.assign({}, base, { kind: 'kdp', text: t(d.body).slice(0, 150000), ladders, rows, period }));
}
