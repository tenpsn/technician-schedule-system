import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService, User } from './auth.service';

export interface NewUserPayload {
  username: string;
  password: string;
  fullName: string;
  role: 'technician' | 'supervisor' | 'admin';
  email?: string;
  phone?: string;
  province?: string;
}

export interface UpdateUserPayload {
  fullName?: string;
  role?: 'technician' | 'supervisor' | 'admin';
  email?: string;
  phone?: string;
  province?: string;
  active?: boolean;
  password?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private roles$: Observable<User['role'][]> | null = null;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private getHeaders() {
    return { Authorization: `Bearer ${this.auth.token}` };
  }

  // รายการบทบาทที่ใช้ได้มาจาก backend ที่เดียว แคชไว้เพราะไม่เปลี่ยนระหว่างเปิดหน้า
  getRoles(): Observable<User['role'][]> {
    if (!this.roles$) {
      this.roles$ = this.http.get<User['role'][]>(`${environment.apiUrl}/auth/roles`, {
        headers: this.getHeaders()
      }).pipe(shareReplay(1));
    }
    return this.roles$;
  }

  getTeamMembers(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/auth/users`, {
      headers: this.getHeaders()
    });
  }

  getAllUsers(): Observable<User[]> {
    const params = new HttpParams().set('active', 'all');
    return this.http.get<User[]>(`${environment.apiUrl}/auth/users`, {
      headers: this.getHeaders(),
      params
    });
  }

  createUser(payload: NewUserPayload): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/auth/register`, payload, {
      headers: this.getHeaders()
    });
  }

  updateUser(id: string, payload: UpdateUserPayload): Observable<User> {
    return this.http.patch<User>(`${environment.apiUrl}/auth/users/${id}`, payload, {
      headers: this.getHeaders()
    });
  }
}
