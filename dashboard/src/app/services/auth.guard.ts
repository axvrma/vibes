import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { catchError, map, of } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.user) {
    if (authService.user.role === 'admin') {
      return true;
    }
  }

  // Attempt to refresh
  return authService.refresh().pipe(
    map((res) => {
      if (res && res.user && res.user.role === 'admin') {
        return true;
      }
      return router.createUrlTree(['/login']);
    }),
    catchError(() => {
      return of(router.createUrlTree(['/login']));
    })
  );
};
