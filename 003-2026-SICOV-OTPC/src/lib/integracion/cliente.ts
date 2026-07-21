import { modoIntegracion } from "@/lib/integracion/modo";
import { ClienteStub } from "@/lib/integracion/cliente-stub";
import { ClienteHttp } from "@/lib/integracion/cliente-http";

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
