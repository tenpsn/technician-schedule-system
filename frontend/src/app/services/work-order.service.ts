import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface ActualLogEntry {
  actualDate: string;
  actualStartTime?: string;
  actualEndTime?: string;
  actualLocation?: string;
  actualDescription: string;
  repairCompleted?: boolean;
  repairIncompleteReason?: string;
  installationDelivered?: boolean;
  recordedAt: string;
}

export interface RescheduleHistoryEntry {
  fromDate: string;
  toDate: string;
  reason: string;
  changedBy: string;
  changedByName?: string | null;
  changedAt: string;
}

export interface WorkOrder {
  _id: string;
  srNumber: string;
  technician: any;
  customerName: string;
  customerLocation: string;
  workType: string;
  description: string;
  plannedDate: string;
  plannedStartTime: string;
  plannedEndTime: string;
  actualDate?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  actualLocation?: string;
  actualDescription?: string;
  repairCompleted?: boolean | null;
  repairIncompleteReason?: string;
  installationDelivered?: boolean;
  actualLog?: ActualLogEntry[];
  photos?: string[];
  status: string;
  approvedBy?: any;
  approvedAt?: string;
  approvalNote?: string;
  approvalHistory?: { approvedById: string; approvedByName?: string | null; approvalNote?: string | null; approvedAt: string }[];
  cancelledBy?: any;
  cancelledAt?: string;
  cancelReason?: string;
  isOverdue: boolean;
  overdueDays: number;
  rescheduleHistory: RescheduleHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class WorkOrderService {
  // environment.apiUrl ends in "/api", but uploaded photos are served from
  // "/uploads/..." off the same origin, so strip the "/api" suffix here.
  private photoBase = environment.apiUrl.replace(/\/api\/?$/, '');

  constructor(private http: HttpClient, private auth: AuthService) {}

  resolvePhotoUrl(p: string): string {
    return this.photoBase + p;
  }

  private getHeaders() {
    return { 
      Authorization: `Bearer ${this.auth.token}`,
      'Content-Type': 'application/json'
    };
  }

  create(order: Partial<WorkOrder>): Observable<WorkOrder> {
    return this.http.post<WorkOrder>(`${environment.apiUrl}/work-orders`, order, 
      { headers: this.getHeaders() });
  }

  getMyOrders(month?: number, year?: number, status?: string): Observable<WorkOrder[]> {
    let params = new HttpParams();
    if (month) params = params.set('month', month.toString());
    if (year) params = params.set('year', year.toString());
    if (status) params = params.set('status', status);
    return this.http.get<WorkOrder[]>(`${environment.apiUrl}/work-orders/my`, 
      { headers: this.getHeaders(), params });
  }

  getAllOrders(month?: number, year?: number, technician?: string, status?: string): Observable<WorkOrder[]> {
    let params = new HttpParams();
    if (month) params = params.set('month', month.toString());
    if (year) params = params.set('year', year.toString());
    if (technician) params = params.set('technician', technician);
    if (status) params = params.set('status', status);
    return this.http.get<WorkOrder[]>(`${environment.apiUrl}/work-orders/all`, 
      { headers: this.getHeaders(), params });
  }

  getOrderById(id: string): Observable<WorkOrder> {
    return this.http.get<WorkOrder>(`${environment.apiUrl}/work-orders/${id}`, 
      { headers: this.getHeaders() });
  }

  approve(id: string, note?: string): Observable<WorkOrder> {
    return this.http.patch<WorkOrder>(`${environment.apiUrl}/work-orders/${id}/approve`, 
      { approvalNote: note }, { headers: this.getHeaders() });
  }

  updateActual(id: string, data: any): Observable<WorkOrder> {
    return this.http.patch<WorkOrder>(`${environment.apiUrl}/work-orders/${id}/actual`, 
      data, { headers: this.getHeaders() });
  }

  uploadPhotos(id: string, files: File[]): Observable<WorkOrder> {
    const formData = new FormData();
    files.forEach(f => formData.append('photos', f));
    // Deliberately not using getHeaders() — its hardcoded Content-Type:
    // application/json would stop the browser from setting the multipart
    // boundary, breaking the upload.
    return this.http.patch<WorkOrder>(`${environment.apiUrl}/work-orders/${id}/photos`, formData,
      { headers: { Authorization: `Bearer ${this.auth.token}` } });
  }

  deletePhoto(id: string, photo: string): Observable<WorkOrder> {
    return this.http.request<WorkOrder>('DELETE', `${environment.apiUrl}/work-orders/${id}/photos`,
      { headers: this.getHeaders(), body: { photo } });
  }

  reschedule(id: string, newDate: string, reason: string): Observable<WorkOrder> {
    return this.http.patch<WorkOrder>(`${environment.apiUrl}/work-orders/${id}/reschedule`, 
      { newDate, reason }, { headers: this.getHeaders() });
  }

  cancel(id: string, reason: string): Observable<any> {
    return this.http.patch<any>(`${environment.apiUrl}/work-orders/${id}/cancel`, 
      { cancelReason: reason }, { headers: this.getHeaders() });
  }

  getOverdue(): Observable<WorkOrder[]> {
    return this.http.get<WorkOrder[]>(`${environment.apiUrl}/work-orders/status/overdue`, 
      { headers: this.getHeaders() });
  }

  getCancelledOrders(month?: number, year?: number): Observable<WorkOrder[]> {
    let params = new HttpParams();
    if (month) params = params.set('month', month.toString());
    if (year) params = params.set('year', year.toString());
    return this.http.get<WorkOrder[]>(`${environment.apiUrl}/work-orders/status/cancelled`, 
      { headers: this.getHeaders(), params });
  }
}
