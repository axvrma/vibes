import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, switchMap, filter, take, throwError, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';

let isRefreshing = false;
let refreshTokenSubject = new BehaviorSubject<string | null | false>(null);

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  if(!req.url.startsWith(environment.apiUrl+'/'))return next(req);
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
      if (error.status === 401 && !authReq.url.includes('/auth/')) {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshTokenSubject.next(null);

          return authService.refresh().pipe(
            switchMap((res) => {
              isRefreshing = false;
              refreshTokenSubject.next(res.accessToken);
              const newReq = authReq.clone({
                headers: authReq.headers.set('Authorization', `Bearer ${res.accessToken}`)
              });
              return next(newReq);
            }),
            catchError((err) => {
              isRefreshing = false;
              refreshTokenSubject.next(false);
              authService.logout().subscribe();
              return throwError(() => err);
            })
          );
        } else {
          // Wait for refresh to complete, then retry the request
          return refreshTokenSubject.pipe(
            filter(token => token !== null),
            take(1),
            switchMap(newToken => {
              if(newToken===false)return throwError(()=>new Error('Session expired'));
              const newReq = authReq.clone({
                headers: authReq.headers.set('Authorization', `Bearer ${newToken}`)
              });
              return next(newReq);
            })
          );
        }
      }
      return throwError(() => error);
    })
  );
};
