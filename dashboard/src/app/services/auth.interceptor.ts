import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, switchMap, throwError } from 'rxjs';
import { Router } from '@angular/router';

let isRefreshing = false;

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Apply withCredentials to all requests to our API to send cookies
  let authReq = req.clone({
    withCredentials: true
  });

  const token = authService.token;
  if (token) {
    authReq = authReq.clone({
      headers: authReq.headers.set('Authorization', `Bearer ${token}`)
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !authReq.url.includes('/auth/login') && !authReq.url.includes('/auth/refresh')) {
        if (!isRefreshing) {
          isRefreshing = true;
          return authService.refresh().pipe(
            switchMap((res) => {
              isRefreshing = false;
              const newReq = authReq.clone({
                headers: authReq.headers.set('Authorization', `Bearer ${res.accessToken}`)
              });
              return next(newReq);
            }),
            catchError((err) => {
              isRefreshing = false;
              authService.logout().subscribe();
              return throwError(() => err);
            })
          );
        }
      }
      return throwError(() => error);
    })
  );
};
