import { inject, Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AutenticacionService } from './autenticacion.service';

@Injectable()
export class AuthTokenInterceptor implements HttpInterceptor {
  private readonly auth = inject(AutenticacionService);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // If the request already has an Authorization header (e.g., Paramétricas service), don't override it
    if (req.headers.has('Authorization')) {
      return next.handle(req);
    }
    const token = this.auth.getToken() || localStorage.getItem('auth:token');
    if (!token) return next.handle(req);

    const authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next.handle(authReq);
  }
}
