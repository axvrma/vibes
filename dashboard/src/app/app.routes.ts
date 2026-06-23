import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login.page').then(m => m.LoginPage) },
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard.page').then(m => m.DashboardPage), canActivate: [authGuard] },
  { path: 'dashboard/categories', loadComponent: () => import('./pages/categories.page').then(m => m.CategoriesPage), canActivate: [authGuard] },
  { path: 'dashboard/tags', loadComponent: () => import('./pages/tags.page').then(m => m.TagsPage), canActivate: [authGuard] },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' }
];
