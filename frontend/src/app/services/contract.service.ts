import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Hospital } from './hospital.service';

export interface MaOverdueRound {
  sequenceNo: number;
  daysOverdue: number;
}

export interface MaCurrentRound {
  sequenceNo: number;
  daysLeft: number;
  assigned: boolean;
}

export interface MaCycle {
  overdue: MaOverdueRound[];
  current: MaCurrentRound | null;
}

export interface Contract {
  _id: string;
  hospitalId: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  maIntervalMonths: number;
  hospital?: Hospital;
  maCycle?: MaCycle | null;
}

export interface MaVisitWorkOrder {
  _id: string;
  srNumber: string;
  status: string;
  plannedDate: string;
  technician?: { _id: string; fullName: string; username: string } | null;
}

export interface MaVisit {
  _id: string;
  contractId: string;
  sequenceNo: number;
  scheduledDate: string;
  workOrderId?: string | null;
  workOrder?: MaVisitWorkOrder | null;
}

@Injectable({ providedIn: 'root' })
export class ContractService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  private getHeaders() {
    return { Authorization: `Bearer ${this.auth.token}` };
  }

  getAll(hospitalId?: string): Observable<Contract[]> {
    let params = new HttpParams();
    if (hospitalId) params = params.set('hospitalId', hospitalId);
    return this.http.get<Contract[]>(`${environment.apiUrl}/contracts`, {
      headers: this.getHeaders(),
      params
    });
  }

  create(hospitalId: string, contractNumber: string, startDate: string, endDate: string, maIntervalMonths: number): Observable<Contract> {
    return this.http.post<Contract>(`${environment.apiUrl}/contracts`,
      { hospitalId, contractNumber, startDate, endDate, maIntervalMonths }, { headers: this.getHeaders() });
  }

  update(id: string, hospitalId: string, contractNumber: string, startDate: string, endDate: string, maIntervalMonths: number): Observable<Contract> {
    return this.http.patch<Contract>(`${environment.apiUrl}/contracts/${id}`,
      { hospitalId, contractNumber, startDate, endDate, maIntervalMonths }, { headers: this.getHeaders() });
  }

  getVisits(contractId: string): Observable<MaVisit[]> {
    return this.http.get<MaVisit[]>(`${environment.apiUrl}/contracts/${contractId}/visits`, {
      headers: this.getHeaders()
    });
  }

  updateVisit(contractId: string, visitId: string, scheduledDate: string): Observable<MaVisit> {
    return this.http.patch<MaVisit>(`${environment.apiUrl}/contracts/${contractId}/visits/${visitId}`,
      { scheduledDate }, { headers: this.getHeaders() });
  }

  assignVisit(contractId: string, visitId: string, technicianId: string): Observable<MaVisit> {
    return this.http.post<MaVisit>(`${environment.apiUrl}/contracts/${contractId}/visits/${visitId}/assign`,
      { technicianId }, { headers: this.getHeaders() });
  }
}
