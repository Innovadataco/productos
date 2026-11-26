import { exigirDuenoApi } from "@/auth/sesion";
import { respuestaJson } from "@/auth/respuestas";
import { leerPedidoUmbrales, MAX_CUERPO_UMBRALES } from "@/app/edicion/alertas/pedido-umbrales";
import { crearVersionUmbral } from "@/app/edicion/alertas/crear";
import { ErrorUmbral } from "@/app/edicion/alertas/errores";
import { db } from "@/lib/db";
import { leerCuerpoJson, MENSAJE_CONFLICTO, MENSAJE_FALLO, origenRechazado, respuestaCreada, respuestaInvalida, respuestaSolicitudInvalida } from "@/plan/edicion/http";

export const dynamic = "force-dynamic";

/** UMBRAL_CAMBIO (otra versión en medio) marca la versión de partida (409); el autor que no existe, 403. */
function respuestaDeError(error: unknown): Response {
  if (error instanceof ErrorUmbral && error.codigo === "UMBRAL_CAMBIO") {
    return respuestaJson({ error: MENSAJE_CONFLICTO, campos: [{ campo: "versionBase", codigo: "UMBRAL_CAMBIO" }] }, 409);
  }
  if (error instanceof ErrorUmbral) return respuestaJson({ error: MENSAJE_FALLO, campos: [{ campo: "cuerpo", codigo: error.codigo }] }, 403);
  console.error(`[edicion:alertas-umbrales] no se pudo guardar (${error instanceof Error ? error.name : "desconocido"})`);
  return respuestaJson({ error: MENSAJE_FALLO }, 500);
}

/**
 * POST /api/alertas/umbrales · una versión NUEVA de los umbrales de las alertas, solo del dueño, con la protección de
 * /api/operar/tarifas: Origin de la lista (CSRF) → guardián del dueño (la familia, 403) → cuerpo JSON acotado con claves
 * exactas → los rangos del motor (src/alertas/umbrales.ts) → `crearVersionUmbral` contra la última versión que vio el
 * formulario (409 si otra entró en medio). El autor sale de la sesión. Sin caché; errores genéricos, sin valores.
 */
export async function POST(pedido: Request): Promise<Response> {
  const rechazo = origenRechazado(pedido);
  if (rechazo) return rechazo;
  try {
    const sesion = await exigirDuenoApi(pedido);
    if (!sesion.ok) return sesion.respuesta;
    const cuerpo = await leerCuerpoJson(pedido, MAX_CUERPO_UMBRALES);
    if (!cuerpo.ok) return respuestaSolicitudInvalida();
    const leido = leerPedidoUmbrales(cuerpo.valor);
    if (!leido.ok) return respuestaInvalida(leido.errores);
    const creada = await crearVersionUmbral(db, { umbrales: leido.umbrales, motivo: leido.motivo }, { autorId: sesion.usuario.id, ultimaEsperada: leido.versionBase });
    return respuestaCreada({ version: creada.version });
  } catch (error) {
    return respuestaDeError(error);
  }
}
