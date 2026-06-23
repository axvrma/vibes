import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { tap, catchError } from 'rxjs/operators';
import { throwError, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.apiUrl;
  
  private userSubject = new BehaviorSubject<any>(null);
  user$ = this.userSubject.asObservable();
  
  private accessToken: string | null = null;
  
  constructor(private http: HttpClient, private router: Router) {}

  get user() {
    return this.userSubject.value;
  }

  get token() {
    return this.accessToken;
  }

  setToken(token: string) {
    this.accessToken = token;
  }

  login(credentials: any) {
    return this.http.post<any>(`${this.apiUrl}/auth/login`, { ...credentials, clientType: 'dashboard' }).pipe(
      tap(res => {
        this.accessToken = res.accessToken;
        this.userSubject.next(res.user);
      })
    );
  }

  refresh() {
    return this.http.post<any>(`${this.apiUrl}/auth/refresh`, {}, { withCredentials: true }).pipe(
      tap(res => {
        this.accessToken = res.accessToken;
        this.userSubject.next(res.user);
      })
    );
  }

  logout() {
    return this.http.post(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.accessToken = null;
        this.userSubject.next(null);
        this.router.navigate(['/login']);
      }),
      catchError(() => {
        this.accessToken = null;
        this.userSubject.next(null);
        this.router.navigate(['/login']);
        return [];
      })
    );
  }

  logoutAll() {
    return this.http.post(`${this.apiUrl}/auth/logout-all`, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.accessToken = null;
        this.userSubject.next(null);
        this.router.navigate(['/login']);
      })
    );
  }

  getSessions() {
    return this.http.get<{ sessions: any[] }>(`${this.apiUrl}/auth/sessions`, { withCredentials: true });
  }

  revokeSession(sessionId: string) {
    return this.http.delete(`${this.apiUrl}/auth/sessions/${sessionId}`, { withCredentials: true });
  }
}
