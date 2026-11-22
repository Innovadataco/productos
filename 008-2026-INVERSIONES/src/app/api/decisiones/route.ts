import { exigirDuenoApi } from "@/auth/sesion";
import { db } from "@/lib/db";
import { corregirDecision, registrarDecision, registrarDecisionConOrden } from "@/plan/decisiones";
import { MAX_CUERPO_DECISION } from "@/plan/edicion/comun";
import { leerCuerpoJson, origenRechazado, respuestaCreada, respuestaDeError, respuestaInvalida, respuestaSolicitudInvalida } from "@/plan/edicion/http";
import { leerPedidoDecision } from "@/plan/edicion/leer-decision";

export const dynamic = "force-dynamic";

/**
 * POST /api/decisiones · una decisión del diario, solo del dueño (fase B, área de edición): qué decidió, por qué y con
 * qué regla. En orden: Origin de la lista (CSRF) → guardián del dueño (la familia, 403) → cuerpo JSON acotado con
 * claves exactas → el dominio: con `ordenId`, la decisión y el enlace a su orden de Trii en una sola transacción; con
 * `corrige`, una corrección que reemplaza a esa decisión y se lleva sus órdenes; si no, la decisión sola. El autor
 * sale de la sesión. Nada se edita ni se borra. Sin caché; errores genéricos.
 */
export async function POST(pedido: Request): Promise<Response> {
  const rechazo = origenRechazado(pedido);
  if (rechazo) return rechazo;
  try {
    const sesion = await exigirDuenoApi(pedido);
    if (!sesion.ok) return sesion.respuesta;
    const cuerpo = await leerCuerpoJson(pedido, MAX_CUERPO_DECISION);
    if (!cuerpo.ok) return respuestaSolicitudInvalida();
    const leido = leerPedidoDecision(cuerpo.valor);
    if (!leido.ok) return respuestaInvalida(leido.errores);
    const { ordenId, corrige, ...datos } = leido.valor;
    const decision = { ...datos, autorId: sesion.usuario.id };
    if (corrige) return respuestaCreada({ id: (await corregirDecision(db, corrige, decision)).id });
    if (ordenId) return respuestaCreada({ id: (await registrarDecisionConOrden(db, decision, ordenId)).id });
    return respuestaCreada({ id: (await registrarDecision(db, decision)).id });
  } catch (error) {
    return respuestaDeError(error, "decisiones");
  }
}
