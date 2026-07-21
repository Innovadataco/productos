import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import {
  ConsultaIntegradoraBody,
  RegistroDespachoIntegracion,
  RegistroLlegadaIntegracion,
} from '../models/Integracion';
import { Novedad } from '../models/Novedades';
import { BaseApiService } from 'src/app/core/base-api.service';

const INTEGRACION = '/api/v1/integracion';

@Injectable({ providedIn: 'root' })
export class DespachosService {
  private readonly api = inject(BaseApiService);
  private readonly host = environment.urlBackend;

  /**
   * GET /api/v1/despachos?nit=
   * Listado de salidas por NIT. Activo en el backend pero no documentado en Swagger de integración.
   */
  listarDespachos(nit?: string) {
    let url = `${this.host}/api/v1/despachos`;
    if (nit) url += `?nit=${encodeURIComponent(nit)}`;
    return this.api.get(url);
  }

  /** POST /api/v1/integracion/despachos — registro completo en un solo payload */
  registrarDespachoIntegracion(payload: RegistroDespachoIntegracion) {
    return this.api.post(`${this.host}${INTEGRACION}/despachos`, payload);
  }

  /** GET /api/v1/integracion/despachos/consulta/{id} */
  obtenerDespacho(id: number) {
    return this.api.get(`${this.host}${INTEGRACION}/despachos/consulta/${id}`);
  }

  /** GET /api/v1/integracion/despachos/placa/{placa} */
  consultarSalidaPorPlaca(placa: string, fechaSalida?: string) {
    let url = `${this.host}${INTEGRACION}/despachos/placa/${encodeURIComponent(placa)}`;
    if (fechaSalida) url += `?fechaSalida=${encodeURIComponent(fechaSalida)}`;
    return this.api.get(url);
  }

  /** GET /api/v1/integracion/despachos/solicitud/{id} */
  obtenerSolicitudDespacho(id: number) {
    return this.api.get(`${this.host}${INTEGRACION}/despachos/solicitud/${id}`);
  }

  /** POST /api/v1/integracion/integradora/resumen */
  consultaIntegradora(body: ConsultaIntegradoraBody) {
    return this.api.post(`${this.host}${INTEGRACION}/integradora/resumen`, body);
  }

  obtenerNivelesServicio(page = 1, numeroItems = 100) {
    return this.api.get(
      `${this.host}${INTEGRACION}/maestras/nivel-servicio?page=${page}&numero_items=${numeroItems}`
    );
  }

  obtenerTiposIdentificacion() {
    return this.api.get(`${this.host}${INTEGRACION}/maestras/tipo-identificaciones`);
  }

  obtenerClasesVehiculo() {
    return this.api.get(`${this.host}${INTEGRACION}/maestras/clase-vehiculo`);
  }

  obtenerCentrosPoblados() {
    return this.api.get(`${this.host}${INTEGRACION}/maestras/centros-poblados`);
  }

  obtenerRutas(nitEmpresa: string) {
    return this.api.get(
      `${this.host}${INTEGRACION}/maestras/rutas-activas-empresa?nit=${encodeURIComponent(nitEmpresa)}`
    );
  }

  consultarAutorizaciones(p: { nit: string; placa: string; fecha: string }) {
    const q = `nit=${encodeURIComponent(p.nit)}&placa=${encodeURIComponent(p.placa)}&fecha=${encodeURIComponent(p.fecha)}`;
    return this.api.get(`${this.host}${INTEGRACION}/maestras/autorizaciones?${q}`);
  }

  /** POST /api/v1/novedades */
  crearNovedad(novedad: Novedad) {
    return this.api.post(`${this.host}/api/v1/novedades`, novedad);
  }

  listarNovedades(page: number, numeroItems: number, find?: string) {
    let url = `${this.host}/api/v1/novedades?page=${page}&numero_items=${numeroItems}`;
    if (find) url += `&find=${encodeURIComponent(find)}`;
    return this.api.get(url);
  }

  crearVehículoNovedad(body: Record<string, unknown>) {
    return this.api.post(`${this.host}/api/v1/novedadesvehiculo`, body);
  }

  crearConductorNovedad(body: Record<string, unknown>) {
    return this.api.post(`${this.host}/api/v1/novedadesconductor`, body);
  }

  /** GET /api/v1/integracion/llegadas?nit=&page=&numero_items= */
  listarLlegadas(nit: string, page = 1, numeroItems = 10) {
    const params = new URLSearchParams({
      nit,
      page: String(page),
      numero_items: String(numeroItems),
    });
    return this.api.get(`${this.host}${INTEGRACION}/llegadas?${params.toString()}`);
  }

  /** POST /api/v1/integracion/llegadas */
  registrarLlegadaIntegracion(payload: RegistroLlegadaIntegracion) {
    return this.api.post(`${this.host}${INTEGRACION}/llegadas`, payload);
  }

  /** GET /api/v1/integracion/llegadas/solicitud/{id} */
  obtenerSolicitudLlegada(id: number) {
    return this.api.get(`${this.host}${INTEGRACION}/llegadas/solicitud/${id}`);
  }

  // Alias de compatibilidad
  obtenerSalida(id: number) {
    return this.obtenerDespacho(id);
  }

  consultaApiIntegradora(body: ConsultaIntegradoraBody) {
    return this.consultaIntegradora(body);
  }
}
