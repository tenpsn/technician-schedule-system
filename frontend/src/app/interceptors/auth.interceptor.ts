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
    // Centralized safety net: every service already builds its own
    // Authorization header, but this means a service method that forgets to
    // would otherwise send an unauthenticated request instead of failing
    // loudly. Only touches calls to our own API, and never overrides a
    // header a caller already set (e.g. the multipart photo upload, which
    // deliberately omits Content-Type but keeps its own Authorization).
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
        // A 500 means an unhandled exception on the server (DB down, a bug) —
        // the backend intentionally sends back a generic message rather than
        // the raw exception text, but that text is only ever in one language.
        // Every component just shows err.error.message directly, so rewrite
        // it here once, in the language the user actually has selected,
        // instead of teaching every call site about this.
        if (error.status === 500 && error.error && typeof error.error === 'object') {
          error.error.message = this.i18n.t['serverError'];
        }
        return throwError(() => error);
      })
    );
  }
}
