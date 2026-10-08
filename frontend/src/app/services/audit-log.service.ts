import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface AuditChange {
  field: string;
  from: string | number | null;
  to: string | number | null;
  seq?: number;
}

export interface AuditLog {
  _id: string;
  entityType: 'hospital' | 'contract';
  entityLabel: string;
  action: 'create' | 'update' | 'delete';
  changes: AuditChange[];
  actorName: string | null;
  createdAt: string;
}

export interface AuditLogPage {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  list(options: { page: number; pageSize: number; entityType?: string; search?: string }): Observable<AuditLogPage> {
    let params = new HttpParams().set('page', options.page).set('pageSize', options.pageSize);
    if (options.entityType) params = params.set('entityType', options.entityType);
    if (options.search) params = params.set('search', options.search);
    return this.http.get<AuditLogPage>(`${environment.apiUrl}/audit-logs`, {
      headers: { Authorization: `Bearer ${this.auth.token}` },
      params
    });
  }
}
