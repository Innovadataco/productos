import { exigirDuenoApi } from "@/auth/sesion";
import { db } from "@/lib/db";
import { MAX_CUERPO_ENLACE } from "@/plan/edicion/comun";
import { leerCuerpoJson, origenRechazado, respuestaCreada, respuestaDeError, respuestaInvalida, respuestaSolicitudInvalida } from "@/plan/edicion/http";
import { leerPedidoEnlace } from "@/plan/edicion/leer-enlace";
import { enlazarOrden } from "@/plan/enlaces";

export const dynamic = "force-dynamic";

/**
 * POST /api/decisiones/enlaces · enlaza una orden importada de Trii a la decisión vigente que la originó, solo del dueño
 * (fase B, área de edición). En orden: Origin de la lista (CSRF) → guardián del dueño (la familia, 403) → cuerpo JSON
 * con solo la decisión y la orden → `enlazarOrden` (aprobada, misma especie y lado, no anterior a la decisión; una
 * orden que ya tiene decisión, 409). Sin motivo: cambiar un enlace no se hace desde la web. El autor sale de la sesión.
 */
export async function POST(pedido: Request): Promise<Response> {
  const rechazo = origenRechazado(pedido);
  if (rechazo) return rechazo;
  try {
    const sesion = await exigirDuenoApi(pedido);
    if (!sesion.ok) return sesion.respuesta;
    const cuerpo = await leerCuerpoJson(pedido, MAX_CUERPO_ENLACE);
    if (!cuerpo.ok) return respuestaSolicitudInvalida();
    const leido = leerPedidoEnlace(cuerpo.valor);
    if (!leido.ok) return respuestaInvalida(leido.errores);
    await enlazarOrden(db, { ...leido.valor, autorId: sesion.usuario.id, motivo: null });
    return respuestaCreada({ decisionId: leido.valor.decisionId });
  } catch (error) {
    return respuestaDeError(error, "enlaces");
  }
}
