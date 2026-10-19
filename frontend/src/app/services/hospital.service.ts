import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Hospital {
  _id: string;
  name: string;
  address: string;
  facilityCode?: string | null;
  addressLine?: string | null;
  subdistrict?: string | null;
  district?: string | null;
  province?: string | null;
  postalCode?: string | null;
  region?: string | null;
}

// ค่าที่ส่งตอนเพิ่มหรือแก้โรงพยาบาล ที่อยู่เต็ม server จะรวมให้เอง
export interface HospitalInput {
  name: string;
  addressLine: string;
  province: string;
  district: string;
  subdistrict: string;
  postalCode: string;
  facilityCode?: string;
}

@Injectable({ providedIn: 'root' })
export class HospitalService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  private getHeaders() {
    return { Authorization: `Bearer ${this.auth.token}` };
  }

  search(query: string): Observable<Hospital[]> {
    const params = new HttpParams().set('search', query);
    return this.http.get<Hospital[]>(`${environment.apiUrl}/hospitals`, {
      headers: this.getHeaders(),
      params
    });
  }

  getAll(): Observable<Hospital[]> {
    const params = new HttpParams().set('limit', '1000');
    return this.http.get<Hospital[]>(`${environment.apiUrl}/hospitals`, {
      headers: this.getHeaders(),
      params
    });
  }

  create(input: HospitalInput): Observable<Hospital> {
    return this.http.post<Hospital>(`${environment.apiUrl}/hospitals`, input, { headers: this.getHeaders() });
  }

  update(id: string, input: HospitalInput): Observable<Hospital> {
    return this.http.patch<Hospital>(`${environment.apiUrl}/hospitals/${id}`, input, { headers: this.getHeaders() });
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/hospitals/${id}`, {
      headers: this.getHeaders()
    });
  }
}
