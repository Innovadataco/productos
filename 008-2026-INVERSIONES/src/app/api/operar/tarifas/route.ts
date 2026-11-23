import { exigirDuenoApi } from "@/auth/sesion";
import { respuestaJson } from "@/auth/respuestas";
import { db } from "@/lib/db";
import { crearVersionTarifa } from "@/operar/tarifa/crear";
import { ErrorTarifa } from "@/operar/tarifa/errores";
import { leerPedidoTarifa, MAX_CUERPO_TARIFA } from "@/operar/tarifa/pedido";
import { leerCuerpoJson, MENSAJE_CONFLICTO, MENSAJE_FALLO, origenRechazado, respuestaCreada, respuestaInvalida, respuestaSolicitudInvalida } from "@/plan/edicion/http";
import { fechaEnBogota } from "@/precios/horario";

export const dynamic = "force-dynamic";

/** TARIFA_CAMBIO (otra versión en medio) marca la versión de partida (409); el autor que no existe, 403. */
function respuestaDeError(error: unknown): Response {
  if (error instanceof ErrorTarifa && error.codigo === "TARIFA_CAMBIO") {
    return respuestaJson({ error: MENSAJE_CONFLICTO, campos: [{ campo: "versionBase", codigo: "TARIFA_CAMBIO" }] }, 409);
  }
  if (error instanceof ErrorTarifa) return respuestaJson({ error: MENSAJE_FALLO, campos: [{ campo: "cuerpo", codigo: error.codigo }] }, 403);
  console.error(`[edicion:tarifas] no se pudo guardar (${error instanceof Error ? error.name : "desconocido"})`);
  return respuestaJson({ error: MENSAJE_FALLO }, 500);
}

/**
 * POST /api/operar/tarifas · una versión NUEVA de la tarifa de un comisionista y un lado, solo del dueño (O5), con la
 * protección de /api/ia/config: Origin de la lista (CSRF) → guardián del dueño (la familia, 403) → cuerpo JSON acotado
 * con claves exactas → `crearVersionTarifa` contra la última versión que vio el formulario (409 si otra entró en
 * medio). El autor sale de la sesión. Sin caché; errores genéricos, sin valores.
 */
export async function POST(pedido: Request): Promise<Response> {
  const rechazo = origenRechazado(pedido);
  if (rechazo) return rechazo;
  try {
    const sesion = await exigirDuenoApi(pedido);
    if (!sesion.ok) return sesion.respuesta;
    const cuerpo = await leerCuerpoJson(pedido, MAX_CUERPO_TARIFA);
    if (!cuerpo.ok) return respuestaSolicitudInvalida();
    const leido = leerPedidoTarifa(cuerpo.valor, fechaEnBogota(new Date()));
    if (!leido.ok) return respuestaInvalida(leido.errores);
    const creada = await crearVersionTarifa(db, leido.valor, { autorId: sesion.usuario.id, ultimaEsperada: leido.versionBase });
    return respuestaCreada({ version: creada.version });
  } catch (error) {
    return respuestaDeError(error);
  }
}
