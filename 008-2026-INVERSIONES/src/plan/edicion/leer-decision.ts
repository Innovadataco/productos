/**
 * El pedido de una decisión del diario (POST /api/decisiones) → los datos de `registrarDecision`,
 * `registrarDecisionConOrden` (con `ordenId`) o `corregirDecision` (con `corrige`). Puro. Claves exactas, topes y
 * tipos; la cantidad, como la escribe el dueño (es-CO). Una orden y una corrección a la vez, no: la corrección mueve
 * sola las órdenes de la anterior. Lo demás (fecha futura, «no actuar» sin cantidad, la regla…) lo valida el dominio.
 */
import type { AccionPlan } from "@prisma/client";
import { CUERPO_INVALIDO, Errores, booleano, cantidad, enumerado, fecha, id, idOpcional, objetoConClaves, texto, type Lectura } from "./comun";

const CLAVES = ["fechaDecision", "instrumentoId", "accion", "cantidad", "reglaId", "excepcion", "motivo", "ordenId", "corrige"] as const;

export interface PedidoDecision {
  readonly fechaDecision: Date;
  readonly instrumentoId: string;
  readonly accion: AccionPlan;
  readonly cantidad: bigint | null;
  readonly reglaId: string | null;
  readonly excepcion: boolean;
  readonly motivo: string;
  /** La orden de Trii que la ejecutó (solo en una decisión nueva). */
  readonly ordenId: string | null;
  /** La decisión que esta corrige. */
  readonly corrige: string | null;
}

export function leerPedidoDecision(valor: unknown): Lectura<PedidoDecision> {
  const v = objetoConClaves(valor, CLAVES);
  if (!v) return CUERPO_INVALIDO;
  const e = new Errores();
  const d = {
    fechaDecision: fecha(e, "fechaDecision", v["fechaDecision"]),
    instrumentoId: id(e, "instrumentoId", v["instrumentoId"]),
    accion: enumerado<AccionPlan>(e, "accion", v["accion"]),
    cantidad: cantidad(e, "cantidad", v["cantidad"]),
    reglaId: idOpcional(e, "reglaId", v["reglaId"]),
    excepcion: booleano(e, "excepcion", v["excepcion"]),
    motivo: texto(e, "motivo", v["motivo"]),
    ordenId: idOpcional(e, "ordenId", v["ordenId"]),
    corrige: idOpcional(e, "corrige", v["corrige"]),
  };
  if (d.ordenId && d.corrige) e.anotar("ordenId", "ORDEN_CON_CORRECCION");
  return e.hay || Object.values(d).includes(undefined) ? { ok: false, errores: e.lista } : { ok: true, valor: d as PedidoDecision };
}
