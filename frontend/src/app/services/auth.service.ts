import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ProfileUpdatePayload {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  currentPassword?: string;
}

export interface User {
  _id: string;
  username: string;
  fullName: string;
  role: 'technician' | 'supervisor' | 'admin';
  email?: string;
  phone?: string;
  active?: boolean;
  token?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
      this.currentUserSubject.next(JSON.parse(saved));
    }
  }

  login(username: string, password: string): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/auth/login`, 
      { username, password }).pipe(
      tap(user => {
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.currentUserSubject.next(user);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }

  getMe(): Observable<User> {
    const headers = { Authorization: `Bearer ${this.token}` };
    return this.http.get<User>(`${environment.apiUrl}/auth/me`, { headers });
  }

  updateProfile(payload: ProfileUpdatePayload): Observable<User> {
    const headers = { Authorization: `Bearer ${this.token}` };
    return this.http.patch<User>(`${environment.apiUrl}/auth/me`, payload, { headers }).pipe(
      tap(updated => {
        const current = this.currentUserSubject.value;
        if (!current) return;
        const merged: User = { ...current, fullName: updated.fullName, email: updated.email, phone: updated.phone };
        localStorage.setItem('currentUser', JSON.stringify(merged));
        this.currentUserSubject.next(merged);
      })
    );
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get token(): string | null {
    return this.currentUser?.token || null;
  }

  get isAuthenticated(): boolean {
    const user = this.currentUser;
    if (!user) return false;
    if (user.token && this.isTokenExpired(user.token)) {
      // Route guards only check isAuthenticated, so without this an expired
      // session would render a protected page before the first API call
      // 401s and the interceptor kicks it back to login.
      this.logout();
      return false;
    }
    return true;
  }

  // Reads the JWT's exp claim client-side — no signature check, just enough
  // to avoid showing protected UI with a token the server will reject anyway.
  private isTokenExpired(token: string): boolean {
    const payload = this.decodeJwtPayload(token);
    if (!payload || typeof payload.exp !== 'number') return false;
    return Date.now() >= payload.exp * 1000;
  }

  private decodeJwtPayload(token: string): any {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  }

  get isSupervisor(): boolean {
    return this.currentUser?.role === 'supervisor' || this.currentUser?.role === 'admin';
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }
}
