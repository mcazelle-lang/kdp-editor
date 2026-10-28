import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-guide-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page guide">
      <div class="page-head"><h1>Guide KDP low-content</h1><span class="muted small">Résumé des skills « kdp-mise-en-page » et « kdp-marketing-low-content » (dossier .claude/skills)</span></div>
      <div class="cols">
        <section class="card">
          <h2>1. Trouver une niche</h2>
          <ol>
            <li>Partez d'un <b>usage</b> (registre obligatoire, passion, événement, métier) plutôt que d'un format.</li>
            <li>Tapez l'usage dans la recherche Amazon (catégorie Livres) : notez l'autocomplétion, elle reflète ce que les gens cherchent.</li>
            <li>Ouvrez les 10 premiers résultats : un BSR inférieur à ~300 000 sur plusieurs titres prouve la demande ; moins de 100 avis sur la plupart signale une concurrence abordable.</li>
            <li>Cherchez l'angle manquant : format (A4 vs poche), public (enfant, pro), langue (FR peu couverte), intérieur plus complet.</li>
            <li>Les registres professionnels (caisse, inventaire, personnel, stupéfiants…) se vendent toute l'année mais doivent refléter la réglementation en vigueur : faites valider le contenu.</li>
          </ol>
        </section>
        <section class="card">
          <h2>2. Titre & sous-titre</h2>
          <ul>
            <li>Formule : <b>[Produit] + [bénéfice / public]</b>. Ex. « Carnet de mots de passe — Répertoire alphabétique A-Z pour noter identifiants et codes ».</li>
            <li>Titre + sous-titre ≤ 200 caractères, sans marque, sans « best-seller », sans répétition de « carnet / journal / cadeau ».</li>
            <li>Le titre de la couverture doit correspondre à la fiche KDP.</li>
            <li>Les variantes de couleur peuvent porter un suffixe (« – Vert sapin ») pour les distinguer.</li>
          </ul>
        </section>
        <section class="card">
          <h2>3. Mots-clés (7 × 50 caractères)</h2>
          <ul>
            <li>Une case = une famille d'intentions : <b>support</b> (carnet, cahier), <b>cible</b> (infirmière, ado), <b>usage</b> (suivi, inventaire), <b>occasion</b> (cadeau fête des pères), <b>synonymes</b>.</li>
            <li>Ne répétez pas les mots du titre ni de la catégorie : Amazon les indexe déjà.</li>
            <li><b>Interdit</b> : marques (Moleskine, Exacompta, Disney, Posca…), noms d'auteurs, fautes volontaires, guillemets, « meilleur », « nouveau », « Kindle ».</li>
            <li>Ordre naturel des mots : « cadeau maîtresse fin d'année » plutôt qu'une liste en vrac.</li>
          </ul>
        </section>
        <section class="card">
          <h2>4. Description</h2>
          <ul>
            <li>Balises acceptées : h4, h5, h6, b, i, u, em, p, br, ul, ol, li. Les h1/h2/h3 et strong sont refusées (bouton « Corriger le HTML »).</li>
            <li>Structure : accroche (h4) → pour qui / pourquoi → liste du contenu → caractéristiques (format, pages, finition).</li>
            <li>Pas d'URL, d'avis, de prix, d'emoji. Sans ISBN, ne parlez pas de « Feuilleter » : l'option n'existe pas en low-content.</li>
          </ul>
        </section>
        <section class="card">
          <h2>5. Couverture qui vend</h2>
          <ul>
            <li>Jugez-la à la taille vignette (≈ 160 px) : titre lisible, 2-3 couleurs, un seul message.</li>
            <li>Copiez les codes de la niche (registre = sobre, cuir ; enfant = coloré, rond) puis démarquez-vous par la couleur.</li>
            <li>Contraste ≥ 4,5:1 entre texte et fond, texte dans la zone de sécurité, zone code-barres vide.</li>
            <li>Images ≥ 300 DPI ; déclarez les images générées par IA.</li>
          </ul>
        </section>
        <section class="card">
          <h2>6. Prix & lancement</h2>
          <ul>
            <li>Redevance broché : 60 % à partir de 9,99 €/$, 50 % en dessous, moins le coût d'impression.</li>
            <li>Carnet 6×9 de 120 pages : 6,99–8,99 € ; registre A4 de 100 pages : 9,99–12,99 €.</li>
            <li>Commandez un exemplaire d'auteur avant de pousser la publicité.</li>
            <li>Amazon Ads : campagne automatique à 3–5 €/jour pendant 2 semaines, puis mots-clés rentables en manuel.</li>
            <li>KDP limite la création de nouveaux titres (environ 2 par format et par semaine) : qualité > quantité.</li>
          </ul>
        </section>
        <section class="card">
          <h2>7. Mise en page intérieure</h2>
          <ul>
            <li>Interlignes de référence : college ruled 7,1 mm, wide ruled 8,7 mm, narrow 6,35 mm, Seyès 8 mm / 2 mm, pointillés 5 mm.</li>
            <li>Traits ≥ 0,75 pt et gris ≥ 10 %, sinon ils disparaissent à l'impression.</li>
            <li>Marge intérieure selon l'épaisseur (0,375 in jusqu'à 150 pages, 0,5 in jusqu'à 300…).</li>
            <li>Ajoutez de la valeur : page « Ce carnet appartient à », sommaire, index A-Z, pages d'aide (herbier, dégustation), double page différenciée.</li>
          </ul>
        </section>
        <section class="card">
          <h2>8. Conformité</h2>
          <ul>
            <li>Cochez « Low-content book » ; pas de série ni de précommande ; ISBN facultatif (votre propre ISBN seulement).</li>
            <li>Contenu répétitif ou « dupliqué » sans valeur ajoutée = risque de refus. Variez vraiment vos intérieurs.</li>
            <li>Aucune marque ni personnage protégé, ni dans le texte ni dans les images.</li>
          </ul>
        </section>
      </div>
    </div>
  `,
  styles: `
    .cols { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 14px; }
    .guide ul, .guide ol { padding-left: 18px; margin: 0; line-height: 1.55; font-size: 13.5px; }
    .guide li { margin-bottom: 4px; }
  `,
})
export class GuidePage {}
