import { Injectable, inject } from '@angular/core';
import { DespachosService } from '../../despachos/services/despachos.service';
import {
  ConsultaIntegradoraBody,
  RegistroDespachoIntegracion,
  RegistroLlegadaIntegracion,
} from '../../despachos/models/Integracion';
import { Novedad } from '../../despachos/models/Novedades';

/**
 * Fachada sobre DespachosService (API /api/v1/integracion/*).
 * Para listado local de salidas recientes usar SalidasService.
 */
@Injectable({ providedIn: 'root' })
export class SalidasRegistroService {
  private readonly despachos = inject(DespachosService);

  registrarDespachoIntegracion(payload: RegistroDespachoIntegracion) {
    return this.despachos.registrarDespachoIntegracion(payload);
  }

  consultarIntegradora(p: ConsultaIntegradoraBody) {
    return this.despachos.consultaIntegradora(p);
  }

  consultarSalidaPorPlaca(placa: string, fechaSalida?: string) {
    return this.despachos.consultarSalidaPorPlaca(placa, fechaSalida);
  }

  obtenerDespacho(id: number) {
    return this.despachos.obtenerDespacho(id);
  }

  obtenerNivelesServicio() {
    return this.despachos.obtenerNivelesServicio();
  }

  obtenerClasesVehiculo() {
    return this.despachos.obtenerClasesVehiculo();
  }

  obtenerTiposIdentificacion() {
    return this.despachos.obtenerTiposIdentificacion();
  }

  obtenerRutas(nit: string) {
    return this.despachos.obtenerRutas(nit);
  }

  consultarAutorizaciones(p: { nit: string; placa: string; fecha: string }) {
    return this.despachos.consultarAutorizaciones(p);
  }

  crearNovedad(payload: Novedad) {
    return this.despachos.crearNovedad(payload);
  }

  listarNovedades(page: number, numeroItems: number, find?: string) {
    return this.despachos.listarNovedades(page, numeroItems, find);
  }

  crearNovedadVehiculo(payload: Record<string, unknown>) {
    return this.despachos.crearVehículoNovedad(payload);
  }

  crearNovedadConductor(payload: Record<string, unknown>) {
    return this.despachos.crearConductorNovedad(payload);
  }

  /** @deprecated usar obtenerDespacho */
  obtenerSalida(id: number) {
    return this.obtenerDespacho(id);
  }

  registrarLlegadaIntegracion(payload: RegistroLlegadaIntegracion) {
    return this.despachos.registrarLlegadaIntegracion(payload);
  }
}
