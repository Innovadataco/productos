import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of, delay } from 'rxjs';
import { RolItem, UsuarioListado, UsuarioPayload, SubusuarioListado, SubusuarioPayload, ModuloItem } from './usuarios.models';
import { environment } from 'src/environments/environment';
import { AutenticacionService } from '../../core/autenticacion.service';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.urlBackend + '/api/v1';
  // Authorization header is added globally by HTTP interceptor

  listarUsuarios(params?: { rol?: boolean; termino?: string | number; administrador?: string | number }): Observable<UsuarioListado[]> {
    let httpParams = new HttpParams();
    if (params?.rol != null) httpParams = httpParams.set('rol', String(params.rol));
    if (params?.termino != null) httpParams = httpParams.set('termino', String(params.termino));
    if (params?.administrador != null) httpParams = httpParams.set('administrador', String(params.administrador));
    return this.http.get<{ usuarios?: any[] }>(`${this.base}/usuarios/listar`, { params: httpParams }).pipe(
      map(resp => (resp.usuarios ?? []).map(u => this.mapUsuario(u)))
    );
  }

  crearUsuario(payload: UsuarioPayload): Observable<unknown> {
    return this.http.post(`${this.base}/usuarios/registro`, payload);
  }

  editarUsuario(identificacion: number | string, partial: Partial<UsuarioPayload>): Observable<unknown> {
    return this.http.patch(`${this.base}/usuarios/${identificacion}`, partial);
  }

  obtenerRoles(): Observable<RolItem[]> {
    // La API devuelve { rols: [ {_id, _nombre, ...} ] }
    return this.http.get<{ rols?: Array<{ _id: number | string; _nombre: string }> }>(`${this.base}/rol`).pipe(
      map(resp => (resp?.rols ?? []).map(r => ({ id: r._id, nombre: r._nombre })))
    );
  }

  private mapUsuario(raw: any): UsuarioListado {
    return {
      id: raw.id,
      nombre: raw.nombre,
      identificacion: raw.identificacion ?? raw.usuario ?? raw.nit ?? raw.id,
      telefono: raw.telefono ?? null,
      correo: raw.correo ?? null,
      idRol: raw.idRol ?? raw.rolId ?? undefined,
      rolNombre: raw.rolNombre ?? raw.nombreRol ?? undefined,
      parentId: raw.parentId ?? raw.titularId ?? undefined,
      tokenAutorizado: raw.tokenAutorizado ?? raw.token ?? null,
      estado: raw.estado ?? undefined,
    };
  }

  // ---- Subusuarios (stubs hasta disponer de endpoints reales) ----

  listarSubusuarios(adminIdent: number | string): Observable<SubusuarioListado[]> {
    // Usa el listado general con filtro administrador=identificacion
    let params = new HttpParams().set('administrador', String(adminIdent));
    return this.http.get<{ usuarios?: any[] }>(`${this.base}/usuarios/listar`, { params }).pipe(
      map(resp => (resp.usuarios ?? []).map(u => this.mapUsuario(u)) as SubusuarioListado[])
    );
  }

  crearSubusuario(parentId: number | string, payload: SubusuarioPayload): Observable<unknown> {
    // Endpoint esperado: POST `${this.base}/usuarios/${parentId}/subusuarios`
    const body = { ...payload, idRol: 3, parentId: Number(parentId) };
    return of({ ok: true, creado: body }).pipe(delay(300));
  }

  editarSubusuario(parentId: number | string, subId: number | string, partial: Partial<SubusuarioPayload>): Observable<unknown> {
    // Endpoint esperado: PATCH `${this.base}/usuarios/${parentId}/subusuarios/${subId}`
    const body = { ...partial, idRol: 3, parentId: Number(parentId) };
    return of({ ok: true, actualizado: body }).pipe(delay(300));
  }

  eliminarSubusuario(parentId: number | string, subId: number | string): Observable<unknown> {
    // Endpoint esperado: DELETE `${this.base}/usuarios/${parentId}/subusuarios/${subId}`
    return of({ ok: true, eliminado: subId }).pipe(delay(300));
  }

  // ---- Crear usuario con campo administrador (para subusuarios) ----
  crearUsuarioConAdmin(payload: UsuarioPayload & { administrador: number | string }): Observable<any> {
    return this.http.post(`${this.base}/usuarios/registro`, payload);
  }

  // ---- Módulos por rol/usuario ----

  obtenerModulosRol(): Observable<ModuloItem[]> {
    return this.http.get<any>(`${this.base}/rol/modulos`).pipe(
      map((resp: any) => {
        const list = Array.isArray(resp?.modulos)
          ? resp.modulos
          : Array.isArray(resp?.array_data?.modulos)
            ? resp.array_data.modulos
            : Array.isArray(resp)
              ? resp
              : [];
        return list.map((m: any) => ({
          id: m._id ?? m.id ?? m.codigo ?? m.value,
          nombre: m._nombreMostrar ?? m._nombre ?? m.nombre ?? m.label ?? String(m._id ?? m.id ?? m.codigo ?? m.value),
        }));
      })
    );
  }

  obtenerModulosDeUsuario(userId: number | string): Observable<(number | string)[]> {
    return this.http.get<any>(`${this.base}/usuarios/${userId}/modulos`).pipe(
      map((resp: any) => {
        const list = Array.isArray(resp?.array_data?.modulos)
          ? resp.array_data.modulos
          : Array.isArray(resp?.modulos)
            ? resp.modulos
            : Array.isArray(resp)
              ? resp
              : [];
        return list.map((m: any) => (m._id ?? m.id ?? m.codigo ?? m.value));
      })
    );
  }

  obtenerModulosDeUsuarioDetallados(userId: number | string): Observable<ModuloItem[]> {
    return this.http.get<any>(`${this.base}/usuarios/${userId}/modulos`).pipe(
      map((resp: any) => {
        const list = Array.isArray(resp?.array_data?.modulos)
          ? resp.array_data.modulos
          : Array.isArray(resp?.modulos)
            ? resp.modulos
            : Array.isArray(resp)
              ? resp
              : [];
        return list.map((m: any) => ({
          id: m._id ?? m.id ?? m.codigo ?? m.value,
          nombre: m._nombreMostrar ?? m._nombre ?? m.nombre ?? String(m._id ?? m.id ?? m.codigo ?? m.value),
        }));
      })
    );
  }

  asignarModulosUsuario(userId: number | string, modulos: Array<number | string>): Observable<unknown> {
    const body = { modulos: (modulos ?? []).map((x) => Number(x)) };
    return this.http.post(`${this.base}/usuarios/${userId}/modulos`, body);
  }

  // Extrae el id de usuario de respuestas comunes al crear
  extractUserId(resp: any): number | string | undefined {
    return resp?.id ?? resp?.usuarioId ?? resp?.usuario?.id ?? resp?.data?.id ?? resp?.resultado?.id ?? undefined;
  }
}
