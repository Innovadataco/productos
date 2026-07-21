import { modoIntegracion } from "@/lib/integracion/modo";
import { ClienteStub } from "@/lib/integracion/cliente-stub";
import { ClienteHttp } from "@/lib/integracion/cliente-http";
import type { SolicitudIntegradora, RespuestaIntegradora } from "@/lib/integracion/integradora-tipos";
import type { RutaMaestra, AutorizacionMaestra } from "@/lib/despachos/despacho-tipos";

export type RespuestaExterna = Record<string, unknown>;

/// Contrato del cliente de Supertransporte. Dos implementaciones: stub (default) y http (real).
export interface ClienteSupertransporte {
  /// Reporta una transacción armando las 3 cabeceras (doble token) internamente.
  postTransaccional(
    url: string,
    body: unknown,
    identificacion: string,
    idRol: number,
  ): Promise<RespuestaExterna>;

  /// Consulta integradora (solo lectura, síncrona). También arma las 3 cabeceras (server-side).
  consultarIntegradora(
    body: SolicitudIntegradora,
    identificacion: string,
    idRol: number,
  ): Promise<RespuestaIntegradora>;

  /// Maestras (read-through) para el wizard de salidas.
  consultarRutasActivas(nit: string): Promise<RutaMaestra[]>;
  consultarAutorizaciones(nit: string, placa: string, fecha: string): Promise<AutorizacionMaestra[]>;
}

let _cliente: ClienteSupertransporte | null = null;

/// Factory con gate: instancia ClienteHttp SOLO en modo real (doble condición de env);
/// en cualquier otro caso, ClienteStub (nunca toca la red).
export function getClienteSupertransporte(): ClienteSupertransporte {
  if (_cliente) return _cliente;
  _cliente = modoIntegracion() === "real" ? new ClienteHttp() : new ClienteStub();
  return _cliente;
}

/// Solo para tests: reinicia la selección de cliente.
export function _resetClienteSupertransporte(): void {
  _cliente = null;
}
