/**
 * El pedido de enlazar una orden importada de Trii a una decisión vigente (POST /api/decisiones/enlaces) → los datos
 * de `enlazarOrden`. Puro. Solo la decisión y la orden: cambiar un enlace (con motivo) no se hace desde la web.
 */
import { CUERPO_INVALIDO, Errores, id, objetoConClaves, type Lectura } from "./comun";

export interface PedidoEnlace {
  readonly decisionId: string;
  readonly ordenId: string;
}

export function leerPedidoEnlace(valor: unknown): Lectura<PedidoEnlace> {
  const v = objetoConClaves(valor, ["decisionId", "ordenId"]);
  if (!v) return CUERPO_INVALIDO;
  const e = new Errores();
  const decisionId = id(e, "decisionId", v["decisionId"]);
  const ordenId = id(e, "ordenId", v["ordenId"]);
  return decisionId === undefined || ordenId === undefined ? { ok: false, errores: e.lista } : { ok: true, valor: { decisionId, ordenId } };
}
