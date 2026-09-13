import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Hospital {
  _id: string;
  name: string;
  province: string;
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

  create(name: string, province: string): Observable<Hospital> {
    return this.http.post<Hospital>(`${environment.apiUrl}/hospitals`,
      { name, province }, { headers: this.getHeaders() });
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/hospitals/${id}`, {
      headers: this.getHeaders()
    });
  }
}
