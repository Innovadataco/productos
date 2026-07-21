import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { BaseApiService } from '../../core/base-api.service';

export interface RespuestaArchivo {
  nombreAlmacenado: string;
  nombreOriginalArchivo: string;
  ruta: string;
}

@Injectable({ providedIn: 'root' })
export class ServicioArchivos {
  private readonly api = inject(BaseApiService);

  guardarArchivo(archivo: File, categoria: string, usuario: string): Observable<RespuestaArchivo> {

    const fd = new FormData();
    fd.append('archivo', archivo);
    fd.append('idVigilado', String(usuario ?? ''));
    fd.append('rutaRaiz', categoria);

    return this.api.postArchivo<RespuestaArchivo>('/api/v1/archivos', fd);
  }

  descargarArchivo(nombre: string, ruta: string, nombreOriginal?: string){
    const url = `/api/v1/archivos?nombre=${nombre}&ruta=${ruta}`;
    this.api.getArchivo(url, nombreOriginal || nombre || 'archivo');
  }
}
