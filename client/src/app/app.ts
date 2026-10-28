import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { apiBase, isHosted, setApiBase } from './core/api-base';
import { installFonts } from './core/fonts';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  template: `
    <aside class="side">
      <a class="brand" routerLink="/">
        <span class="logo">BC</span>
        <span><b>Book Creator</b><small>Low-content · KDP</small></span>
      </a>
      <nav>
        <a routerLink="/" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }"><span class="i">▤</span> Mes carnets</a>
        <a routerLink="/niches" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }"><span class="i">◈</span> Niches</a>
        <a routerLink="/idees" routerLinkActive="on"><span class="i">✦</span> Idées</a>
        <a routerLink="/kdp" routerLinkActive="on"><span class="i">⇄</span> Compte KDP</a>
        <a routerLink="/formats" routerLinkActive="on"><span class="i">⬚</span> Formats & gabarits</a>
        <a routerLink="/guide" routerLinkActive="on"><span class="i">◎</span> Guide KDP</a>
      </nav>
      <div class="foot">
        @if (hosted || editing()) {
          <div class="server">
            <span>Serveur</span>
            @if (editing()) {
              <input type="text" [(ngModel)]="draftUrl" placeholder="http://localhost:3000" />
              <button (click)="saveServer()">OK</button>
            } @else {
              <button class="link" (click)="editing.set(true)" title="Adresse du serveur Node (API, PDF, assistant)">{{ server || 'même origine' }} ✎</button>
            }
          </div>
        }
        Specs KDP vérifiées le 14/10/2026
      </div>
    </aside>
    <main><router-outlet /></main>
  `,
  styles: `
    :host { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }
    .side { background: var(--side); color: #c9cfe3; display: flex; flex-direction: column; padding: 18px 12px; position: sticky; top: 0; height: 100vh; }
    .brand { display: flex; gap: 10px; align-items: center; color: #fff; text-decoration: none; padding: 4px 8px 22px; }
    .brand b { display: block; font-family: var(--font-head); font-size: 15px; }
    .brand small { display: block; font-size: 11px; color: #8d95b3; }
    .logo { width: 34px; height: 34px; border-radius: 9px; background: var(--accent); color: #fff; display: grid; place-items: center; font-family: var(--font-head); font-weight: 800; font-size: 13px; }
    nav { display: flex; flex-direction: column; gap: 2px; }
    nav a { color: #c9cfe3; text-decoration: none; padding: 9px 10px; border-radius: 8px; font-weight: 600; font-size: 13.5px; display: flex; gap: 10px; align-items: center; }
    nav a:hover { background: var(--side-2); color: #fff; }
    nav a.on { background: var(--side-2); color: #fff; box-shadow: inset 3px 0 0 var(--accent); }
    .i { width: 18px; text-align: center; opacity: 0.8; }
    .foot { margin-top: auto; font-size: 11px; color: #6f7899; padding: 8px; }
    .server { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
    .server span { text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
    .server input { background: var(--side-2); border-color: #39425f; color: #fff; padding: 4px 6px; font-size: 11px; }
    .server button { font: inherit; font-size: 11px; background: var(--side-2); color: #c9cfe3; border: 1px solid #39425f; border-radius: 6px; padding: 3px 6px; cursor: pointer; text-align: left; }
    .server button.link { word-break: break-all; }
    main { min-width: 0; }
    @media (max-width: 800px) { :host { grid-template-columns: 1fr; } .side { position: static; height: auto; } }
  `,
})
export class App {
  hosted = isHosted();
  server = apiBase();
  draftUrl = this.server;
  editing = signal(false);

  saveServer() {
    setApiBase(this.draftUrl);
    location.reload();
  }

  constructor() {
    installFonts();
  }
}
