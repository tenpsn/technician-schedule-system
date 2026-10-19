import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

// จังหวัด แล้วอำเภอหรือเขต แล้วตำบลหรือแขวง คู่กับรหัสไปรษณีย์
export type AddressTree = Record<string, Record<string, Record<string, string>>>;

@Injectable({ providedIn: 'root' })
export class ProvinceService {
  private regionMap$: Observable<Record<string, string>> | null = null;
  private addressTree$: Observable<AddressTree> | null = null;

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

  // ข้อมูลที่อยู่ทั้งประเทศ ดึงครั้งเดียวแล้วใช้ซ้ำทุกหน้า
  getAddressTree(): Observable<AddressTree> {
    if (!this.addressTree$) {
      this.addressTree$ = this.http.get<AddressTree>(`${environment.apiUrl}/provinces/address-tree`, {
        headers: { Authorization: `Bearer ${this.auth.token}` }
      }).pipe(shareReplay(1));
    }
    return this.addressTree$;
  }
}
