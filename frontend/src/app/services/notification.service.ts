import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface AppNotification {
  _id: string;
  type: 'overdue' | 'approval_needed' | 'rescheduled' | 'completed' | 'cancelled';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedWorkOrder?: { _id: string; srNumber: string; customerName: string } | null;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  private getHeaders() {
    return { Authorization: `Bearer ${this.auth.token}` };
  }

  list(limit = 50): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(`${environment.apiUrl}/notifications?limit=${limit}`, {
      headers: this.getHeaders()
    });
  }

  unreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${environment.apiUrl}/notifications/unread/count`, {
      headers: this.getHeaders()
    });
  }

  markRead(id: string): Observable<{ success: boolean }> {
    return this.http.patch<{ success: boolean }>(`${environment.apiUrl}/notifications/${id}/read`, {}, {
      headers: this.getHeaders()
    });
  }

  markAllRead(): Observable<{ success: boolean }> {
    return this.http.patch<{ success: boolean }>(`${environment.apiUrl}/notifications/read-all`, {}, {
      headers: this.getHeaders()
    });
  }
}
