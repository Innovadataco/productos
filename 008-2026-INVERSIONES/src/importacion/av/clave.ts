/**
 * Clave natural de cada fila de la certificación: sha256 de (AV_CERTIFICACION, fecha de corte, tipo de fila,
 * campos canónicos en orden fijo). La clave se guarda EN CLARO (fila_fuente.claveNatural), así que nunca lleva
 * el encargo, la cuenta, el titular ni la descripción del fondo: con pocos dígitos se recuperarían por fuerza
 * bruta. Los montos y cantidades ya están en claro en sus columnas. La ocurrencia sigue el orden del documento,
 * como en Trii (src/importacion/trii/clave.ts): dos lotes idénticos legítimos no se fusionan.
 */
import { createHash } from "node:crypto";
import type { CertificacionLeida, Crudo } from "./filas";

export type TipoFilaAv = "LOTE" | "FONDO" | "EFECTIVO";

export interface RegistroAv {
  readonly tipo: TipoFilaAv;
  readonly pagina: number;
  readonly numero: number;
  readonly canonico: Readonly<Record<string, string>>;
  readonly crudo: Crudo;
}

export interface RegistroAvConClave extends RegistroAv {
  readonly clave: string;
  readonly ocurrencia: number;
}

/** Las filas de la certificación en el orden del documento, con sus campos canónicos. */
export function registrosDe(c: CertificacionLeida): RegistroAv[] {
  const de = (tipo: TipoFilaAv, u: { pagina: number; numero: number; crudo: Crudo }, canonico: Record<string, string>): RegistroAv => ({
    tipo, pagina: u.pagina, numero: u.numero, canonico, crudo: u.crudo,
  });
  return [
    ...c.fondos.map((f) => de("FONDO", f, { nit: f.nit, saldo: f.saldo })),
    ...c.lotes.map((l) => de("LOTE", l, { nemo: l.nemo, cantidad: l.cantidad.toString(), precio: l.precio, valor: l.valor })),
    de("EFECTIVO", c.efectivo, { saldo: c.efectivo.saldo }),
  ].sort((a, b) => a.numero - b.numero);
}

export function claveNaturalAv(fechaCorte: string, r: RegistroAv): string {
  const pares = Object.keys(r.canonico).sort().map((k) => [k, r.canonico[k]] as const);
  return createHash("sha256").update(JSON.stringify(["AV_CERTIFICACION", fechaCorte, r.tipo, pares])).digest("hex");
}

export function asignarClavesAv(fechaCorte: string, registros: readonly RegistroAv[]): RegistroAvConClave[] {
  const vistas = new Map<string, number>();
  return registros.map((r) => {
    const clave = claveNaturalAv(fechaCorte, r);
    const ocurrencia = (vistas.get(clave) ?? 0) + 1;
    vistas.set(clave, ocurrencia);
    return { ...r, clave, ocurrencia };
  });
}
