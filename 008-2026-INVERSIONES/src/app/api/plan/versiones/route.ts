import { exigirDuenoApi } from "@/auth/sesion";
import { db } from "@/lib/db";
import { MAX_CUERPO_VERSION } from "@/plan/edicion/comun";
import { leerCuerpoJson, origenRechazado, respuestaCreada, respuestaDeError, respuestaInvalida, respuestaSolicitudInvalida } from "@/plan/edicion/http";
import { leerPedidoVersion } from "@/plan/edicion/leer-version";
import { crearVersionPlan } from "@/plan/versiones";

export const dynamic = "force-dynamic";

/**
 * POST /api/plan/versiones · una versión NUEVA del plan, solo del dueño (fase B, área de edición). En orden: Origin de
 * la lista (CSRF) → guardián del dueño (la familia, 403) → cuerpo JSON acotado con claves exactas → los datos del
 * dominio, con la lectura de la ficha → `crearVersionPlan`, con las validaciones del importador y contra la última
 * versión que vio el formulario (409 PLAN_CAMBIO si otra entró en medio). El autor sale de la sesión. Nada se edita:
 * la versión nueva reemplaza entera a la anterior, que queda en la historia. Sin caché; errores genéricos.
 */
export async function POST(pedido: Request): Promise<Response> {
  const rechazo = origenRechazado(pedido);
  if (rechazo) return rechazo;
  try {
    const sesion = await exigirDuenoApi(pedido);
    if (!sesion.ok) return sesion.respuesta;
    const cuerpo = await leerCuerpoJson(pedido, MAX_CUERPO_VERSION);
    if (!cuerpo.ok) return respuestaSolicitudInvalida();
    const leido = leerPedidoVersion(cuerpo.valor);
    if (!leido.ok) return respuestaInvalida(leido.errores);
    const { versionBase, ...datos } = leido.valor;
    const creada = await crearVersionPlan(db, { ...datos, autorId: sesion.usuario.id }, { ultimaEsperada: versionBase });
    return respuestaCreada({ version: creada.version });
  } catch (error) {
    return respuestaDeError(error, "versiones");
  }
}
