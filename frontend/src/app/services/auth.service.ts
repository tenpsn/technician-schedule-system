import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ProfileUpdatePayload {
  fullName?: string;
  email?: string;
  phone?: string;
  province?: string;
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
  province?: string;
  region?: string;
  active?: boolean;
  token?: string;
  isSupervisor?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
      const user = JSON.parse(saved);
      this.currentUserSubject.next(user);
      // เซสชันเก่าไม่มี isSupervisor ต้องขอข้อมูลสดมาเติม เลื่อนออกนอกคอนสตรักเตอร์
      // กัน AuthInterceptor ที่ inject AuthService ชนกับตัวเองระหว่างยังสร้างไม่เสร็จ
      if (user.isSupervisor === undefined) {
        Promise.resolve().then(() => this.refreshSupervisorFlag(user));
      }
    }
  }

  private refreshSupervisorFlag(user: User): void {
    this.getMe().subscribe({
      next: (fresh) => {
        const merged: User = { ...user, role: fresh.role, isSupervisor: fresh.isSupervisor };
        localStorage.setItem('currentUser', JSON.stringify(merged));
        this.currentUserSubject.next(merged);
      },
      error: () => {}
    });
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
        const merged: User = { ...current, fullName: updated.fullName, email: updated.email, phone: updated.phone, province: updated.province, region: updated.region, isSupervisor: updated.isSupervisor };
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
      // route guard เช็คแค่ isAuthenticated ถ้าไม่มีบรรทัดนี้ session ที่หมดอายุ
      // จะเข้าหน้าที่ป้องกันไว้ได้ก่อน จนกว่า API call แรกจะโดน 401 แล้ว interceptor เด้งกลับ login
      this.logout();
      return false;
    }
    return true;
  }

  // อ่าน exp claim ของ JWT ฝั่ง client เฉยๆ ไม่เช็ค signature แค่พอกันไม่ให้
  // โชว์ UI ที่ป้องกันไว้ด้วย token ที่ server จะปฏิเสธอยู่แล้ว
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
    return this.currentUser?.isSupervisor ?? false;
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }
}
