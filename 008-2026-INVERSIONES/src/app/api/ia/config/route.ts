import { exigirDuenoApi } from "@/auth/sesion";
import { respuestaJson } from "@/auth/respuestas";
import { crearVersionConfigIa } from "@/ia/config/crear";
import { ErrorConfigIa } from "@/ia/config/errores";
import { permitidoGuardar } from "@/ia/config/frecuencia";
import { leerPedidoConfig, MAX_CUERPO_CONFIG_IA } from "@/ia/config/pedido";
import { LISTA_MODELOS_PI } from "@/ia/local/modelos";
import { db } from "@/lib/db";
import { leerCuerpoJson, MENSAJE_CONFLICTO, MENSAJE_FALLO, origenRechazado, respuestaCreada, respuestaInvalida, respuestaSolicitudInvalida } from "@/plan/edicion/http";

export const dynamic = "force-dynamic";

/** CONFIG_CAMBIO (otra versión en medio) marca el campo de la versión de partida; el autor que no existe, 403. */
function respuestaDeError(error: unknown): Response {
  if (error instanceof ErrorConfigIa && error.codigo === "CONFIG_CAMBIO") {
    return respuestaJson({ error: MENSAJE_CONFLICTO, campos: [{ campo: "versionBase", codigo: "CONFIG_CAMBIO" }] }, 409);
  }
  if (error instanceof ErrorConfigIa) return respuestaJson({ error: MENSAJE_FALLO, campos: [{ campo: "cuerpo", codigo: error.codigo }] }, 403);
  console.error(`[edicion:ia-config] no se pudo guardar (${error instanceof Error ? error.name : "desconocido"})`);
  return respuestaJson({ error: MENSAJE_FALLO }, 500);
}

/**
 * POST /api/ia/config · una versión NUEVA de la configuración de la IA, solo del dueño (E8), con la protección de
 * /api/plan/versiones: Origin de la lista (CSRF) → guardián del dueño (la familia, 403) → un envío cada pocos segundos →
 * cuerpo JSON acotado con claves exactas → lo leído, contra la lista de modelos que publica PI → `crearVersionConfigIa`
 * contra la última versión que vio el formulario (409 si otra entró en medio). El autor sale de la sesión. La llave de
 * la nube nunca viaja ni se guarda. Sin caché; errores genéricos.
 */
export async function POST(pedido: Request): Promise<Response> {
  const rechazo = origenRechazado(pedido);
  if (rechazo) return rechazo;
  try {
    const sesion = await exigirDuenoApi(pedido);
    if (!sesion.ok) return sesion.respuesta;
    const frecuencia = permitidoGuardar(sesion.usuario.id, Date.now());
    if (!frecuencia.permitido) return respuestaJson({ error: "Demasiadas solicitudes" }, 429, { "Retry-After": String(frecuencia.reintentarEnS) });
    const cuerpo = await leerCuerpoJson(pedido, MAX_CUERPO_CONFIG_IA);
    if (!cuerpo.ok) return respuestaSolicitudInvalida();
    const leido = leerPedidoConfig(cuerpo.valor, LISTA_MODELOS_PI);
    if (!leido.ok) return respuestaInvalida(leido.errores);
    const creada = await crearVersionConfigIa(db, leido.valor, { autorId: sesion.usuario.id, ultimaEsperada: leido.versionBase });
    return respuestaCreada({ version: creada.version });
  } catch (error) {
    return respuestaDeError(error);
  }
}
