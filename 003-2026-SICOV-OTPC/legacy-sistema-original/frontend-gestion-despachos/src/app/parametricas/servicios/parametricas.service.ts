import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TipoIdentificacion {
  id: number | string;
  nombre: string;
  codigo?: string;
  estado?: boolean;
}

// Respuesta cruda desde el servicio de Paramétricas
export interface RawTipoIdentificacion {
  codigo: number | string;
  descripcion: string;
  estado?: boolean;
  [k: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class ParametricasService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.urlParametricas;
  private readonly headers = new HttpHeaders({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${environment.tokenParametricas}`,
  });

  obtenerParametrica<T>(nombre: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/api/v1/parametrica/${nombre}` , { headers: this.headers });
  }

  obtenerTipoIdentificaciones(): Observable<TipoIdentificacion[]> {
    return this.obtenerParametrica<RawTipoIdentificacion[]>('listar-tipo-identificaciones').pipe(
      map((lista) =>
        (lista ?? []).map((item) => ({
          id: item.codigo,
          nombre: item.descripcion,
          codigo: String(item.codigo),
          estado: item.estado,
        }))
      )
    );
  }
}

/* Lista de parametricas */
  /*
    listar-tipo-errores
    listar-tipo-identificaciones
    listar-departamentos
    listar-centros-poblados
    listar-tipo-discapacidades
    listar-tipo-documento-habilitacion-rutas
    listar-tipo-generos
    listar-tipo-oapsots
    listar-tipo-parentescos
    listar-tipo-poblaciones-etnicas
    listar-tipo-sexos
    listar-clase-vehiculo
    listar-contrato
    listar-convenio
  */
