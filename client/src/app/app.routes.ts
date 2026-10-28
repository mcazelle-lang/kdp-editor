import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/books/books-page').then((m) => m.BooksPage), title: 'Mes carnets' },
  { path: 'idees', loadComponent: () => import('./pages/ideas/ideas-page').then((m) => m.IdeasPage), title: 'Idées' },
  { path: 'livres/:id', loadComponent: () => import('./pages/editor/editor-page').then((m) => m.EditorPage), title: 'Éditeur' },
  { path: 'niches', loadComponent: () => import('./pages/niches/niches-page').then((m) => m.NichesPage), title: 'Niches' },
  { path: 'niches/capture', loadComponent: () => import('./pages/niches/capture-page').then((m) => m.CapturePage), title: 'Relais Book Creator' },
  { path: 'capture', loadComponent: () => import('./pages/niches/capture-page').then((m) => m.CapturePage), title: 'Relais Book Creator' },
  { path: 'kdp', loadComponent: () => import('./pages/kdp/kdp-page').then((m) => m.KdpPage), title: 'Compte KDP' },
  { path: 'formats', loadComponent: () => import('./pages/formats/formats-page').then((m) => m.FormatsPage), title: 'Formats KDP' },
  { path: 'guide', loadComponent: () => import('./pages/guide/guide-page').then((m) => m.GuidePage), title: 'Guide' },
  { path: '**', redirectTo: '' },
];
