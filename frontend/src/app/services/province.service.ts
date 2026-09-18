import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ProvinceService {
  private regionMap$: Observable<Record<string, string>> | null = null;

  constructor(private http: HttpClient, private auth: AuthService) {}

  // ผังจังหวัดไปเขตดึงจาก backend ที่เดียว แคชไว้เพราะข้อมูลนี้ไม่เปลี่ยนระหว่างเปิดหน้า
  getRegionMap(): Observable<Record<string, string>> {
    if (!this.regionMap$) {
      this.regionMap$ = this.http.get<Record<string, string>>(`${environment.apiUrl}/provinces/regions`, {
        headers: { Authorization: `Bearer ${this.auth.token}` }
      }).pipe(shareReplay(1));
    }
    return this.regionMap$;
  }
}
