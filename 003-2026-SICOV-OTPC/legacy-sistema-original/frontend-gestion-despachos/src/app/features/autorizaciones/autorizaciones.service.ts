import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ServiciosMantenimientos } from '../../mantenimientos/servicios/mantenimientos.service';
import { ServicioArchivos, RespuestaArchivo } from '../../archivos/servicios/archivos.service';
import { AutorizacionDocumento, AutorizacionFormulario, AutorizacionHistorial, AutorizacionRegistro } from './autorizaciones.models';

const TIPO_AUTORIZACION = 4;

@Injectable({ providedIn: 'root' })
export class AutorizacionesService {
  private readonly mantenimientos = inject(ServiciosMantenimientos);
  private readonly archivos = inject(ServicioArchivos);

  listarRegistros(vigiladoId: string, rolId?: string | number | null): Observable<AutorizacionRegistro[]> {
    return this.mantenimientos.listarRegistros(TIPO_AUTORIZACION, vigiladoId, rolId) as Observable<AutorizacionRegistro[]>;
  }

  crearMantenimiento(vigiladoId: string, placa: string): Observable<{ id: string | number }> {
    return this.mantenimientos.guardarMantenimiento(vigiladoId, placa, TIPO_AUTORIZACION) as Observable<{ id: string | number }>;
  }

  guardar(form: AutorizacionFormulario, mantenimientoId: string | number): Observable<unknown> {
    return this.mantenimientos.guardarAutorizacion(form, mantenimientoId);
  }

  visualizar(mantenimientoId: string | number): Observable<AutorizacionFormulario> {
    return this.mantenimientos.visualizarAutorizacion(mantenimientoId) as Observable<AutorizacionFormulario>;
  }

  listarHistorial(vigiladoId: string, placa: string): Observable<AutorizacionHistorial[]> {
    return this.mantenimientos.historial(TIPO_AUTORIZACION, vigiladoId, placa) as Observable<AutorizacionHistorial[]>;
  }

  exportarHistorial(vigiladoId: string, placa: string): string {
    return this.mantenimientos.exportarHistorial(TIPO_AUTORIZACION, vigiladoId, placa);
  }

  // Documentos sueltos (si el backend soporta listar por tipo 4)
  listarDocumentos(vigiladoId: string): Observable<AutorizacionDocumento[]> {
    return this.mantenimientos.listarDocumentos(TIPO_AUTORIZACION, vigiladoId).pipe(
      map((res: any) => {
        const arr: any[] = Array.isArray(res) ? res : [];
        return arr.map((d) => ({
          documento: d.documento,
          ruta: d.ruta,
          nombreOriginal: d.nombreOriginal,
          fecha: d.fecha,
          estado: d.estado,
          id: d.id ?? d.mantenimiento_id ?? undefined,
          tipo_id: d.tipo_id ?? undefined,
        })) as AutorizacionDocumento[];
      })
    );
  }

  subirArchivo(archivo: File, vigiladoId: string): Observable<RespuestaArchivo> {
    return this.archivos.guardarArchivo(archivo, 'sicov', vigiladoId);
  }

  guardarArchivoMetadata(nombreAlmacenado: string, nombreOriginal: string, ruta: string, vigiladoId: string): Observable<unknown> {
    return this.mantenimientos.guardarArchivo(TIPO_AUTORIZACION, nombreAlmacenado, nombreOriginal, ruta, vigiladoId);
  }

  descargarArchivo(documento: string, ruta: string, nombreOriginal: string): void {
    this.archivos.descargarArchivo(documento, ruta, nombreOriginal);
  }
}
