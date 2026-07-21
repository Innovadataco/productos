import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { AutenticacionService } from './autenticacion.service';
import { catchError } from 'rxjs/operators';
import { throwError, Observable } from 'rxjs';
import { saveAs } from 'file-saver';

@Injectable({ providedIn: 'root' })
export class BaseApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AutenticacionService);
  private readonly baseUrl = environment.urlBackend;
  private readonly urlArchivos = environment.urlBackendArchivos;
  private readonly urlIntegradora = environment.urlApiIntegradora;

  private authHeaders(extra?: Record<string, string>, contentType: 'json' | 'none' = 'json') {
    const token = this.auth.getToken();
    // Only set Content-Type for JSON bodies. For FormData, the browser sets the correct boundary.
    let headers = new HttpHeaders(
      contentType === 'json' ? { 'Content-Type': 'application/json', ...(extra || {}) } : { ...(extra || {}) }
    );
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return { headers };
  }

  postArchivo<T>(endpointOrUrl: string, body: unknown) {
    const url = endpointOrUrl.startsWith('http') ? endpointOrUrl : `${this.urlArchivos}${endpointOrUrl}`;
    return this.http.post<T>(url, body, this.authHeaders({}, 'none'));
  }

  getArchivo(endpointOrUrl: string, nombreOriginal: string) {
    const url = endpointOrUrl.startsWith('http') ? endpointOrUrl : `${this.urlArchivos}${endpointOrUrl}`;
    const opts = { ...this.authHeaders() };
    return this.http.get<{archivo: string}>(url, opts)
    .pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error al descargar el archivo:', error);
        return throwError('Error al descargar el archivo.');
      })
    )
    .subscribe((respuesta) => {
      const blob = this.b64toBlob(respuesta.archivo)
      saveAs(blob, nombreOriginal);
    });
  }

  private b64toBlob(b64Data: string, contentType='', sliceSize = 512): Blob{
    const byteCharacters = atob(b64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);

      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, {type: contentType});
    return blob;
  }

  postIntegradora<T>(endpointOrUrl: string, body: unknown) {
    const token = this.auth.getTokenExterno();
    const url = endpointOrUrl.startsWith('http') ? endpointOrUrl : `${this.urlIntegradora}${endpointOrUrl}`;
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.post<T>(url, body, { headers });
  }

  get<T>(endpointOrUrl: string, params?: HttpParams) {
    const url = endpointOrUrl.startsWith('http') ? endpointOrUrl : `${this.baseUrl}${endpointOrUrl}`;
    return this.http.get<T>(url, { ...this.authHeaders(), params });
  }

  // Descarga binaria con autenticación (Blob)
  download(endpointOrUrl: string): Observable<HttpResponse<Blob>> {
    const url = endpointOrUrl.startsWith('http') ? endpointOrUrl : `${this.baseUrl}${endpointOrUrl}`;
    const base = this.authHeaders({ Accept: 'application/octet-stream' }, 'none');
    return this.http.get(url, {
      ...base,
      observe: 'response',
      responseType: 'blob' as 'json',
    }) as unknown as Observable<HttpResponse<Blob>>;
  }

  post<T>(endpointOrUrl: string, body: unknown, isFormData = false) {
    const url = endpointOrUrl.startsWith('http') ? endpointOrUrl : `${this.baseUrl}${endpointOrUrl}`;
    const opts = isFormData ? this.authHeaders({}, 'none') : this.authHeaders();
    return this.http.post<T>(url, body, opts);
  }

  put<T>(endpointOrUrl: string, body: unknown, isFormData = false) {
    const url = endpointOrUrl.startsWith('http') ? endpointOrUrl : `${this.baseUrl}${endpointOrUrl}`;
    const opts = isFormData ? this.authHeaders({}, 'none') : this.authHeaders();
    return this.http.put<T>(url, body, opts);
  }

  delete<T>(endpointOrUrl: string) {
    const url = endpointOrUrl.startsWith('http') ? endpointOrUrl : `${this.baseUrl}${endpointOrUrl}`;
    return this.http.delete<T>(url, this.authHeaders());
  }
}
