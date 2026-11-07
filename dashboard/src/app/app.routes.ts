import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login.page').then(m => m.LoginPage) },
  { path: 'dashboard', loadComponent: () => import('./pages/overview.page').then(m => m.OverviewPage), canActivate: [authGuard] },
  { path: 'dashboard/videos', loadComponent: () => import('./pages/dashboard.page').then(m => m.DashboardPage), canActivate: [authGuard] },
  { path: 'dashboard/libraries', loadComponent: () => import('./pages/libraries.page').then(m => m.LibrariesPage), canActivate: [authGuard] },
  { path: 'dashboard/settings', loadComponent: () => import('./pages/settings.page').then(m => m.SettingsPage), canActivate: [authGuard] },
  { path: 'dashboard/categories', loadComponent: () => import('./pages/categories.page').then(m => m.CategoriesPage), canActivate: [authGuard] },
  { path: 'dashboard/tags', loadComponent: () => import('./pages/tags.page').then(m => m.TagsPage), canActivate: [authGuard] },
  { path: 'dashboard/users', loadComponent: () => import('./pages/users.page').then(m => m.UsersPage), canActivate: [authGuard] },
  { path: 'dashboard/analytics', loadComponent: () => import('./pages/analytics.page').then(m => m.AnalyticsPage), canActivate: [authGuard] },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' }
];
