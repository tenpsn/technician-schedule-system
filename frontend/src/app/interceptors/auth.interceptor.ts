import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { I18nService } from '../services/i18n.service';
import { environment } from '../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService, private router: Router, private i18n: I18nService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // ตัวกันพลาดกลาง กันเผลอลืมใส่ Authorization header ในบาง service
    // ทำแค่กับ API ของเราเอง และไม่ทับ header ที่ผู้เรียกตั้งไว้แล้ว
    const token = this.auth.token;
    const authReq = token && req.url.startsWith(environment.apiUrl) && !req.headers.has('Authorization')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

    return next.handle(authReq).pipe(
      catchError((error) => {
        if (error.status === 401) {
          this.auth.logout();
          this.router.navigate(['/login']);
        }
        // error 500 จาก backend มีแค่ภาษาเดียว แก้เป็นภาษาที่ผู้ใช้เลือกไว้ตรงนี้ที่เดียว
        if (error.status === 500 && error.error && typeof error.error === 'object') {
          error.error.message = this.i18n.t['serverError'];
        }
        return throwError(() => error);
      })
    );
  }
}
