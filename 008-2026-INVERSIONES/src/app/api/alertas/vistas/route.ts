import { exigirDuenoApi } from "@/auth/sesion";
import { respuestaJson } from "@/auth/respuestas";
import { marcarTodas, marcarVista } from "@/app/alertas/marcar";
import { ID_ALERTA } from "@/app/alertas/parametros";
import { db } from "@/lib/db";
import { objetoConClaves } from "@/plan/edicion/comun";
import { leerCuerpoJson, MENSAJE_FALLO, MENSAJE_NO_EXISTE, origenRechazado, respuestaSolicitudInvalida } from "@/plan/edicion/http";
import { fechaEnBogota } from "@/precios/horario";

export const dynamic = "force-dynamic";

/** Un pedido válido tiene UNA sola clave: `alertaId` (texto con la forma de un id) o `todas: true`. Nada más. */
const MAX_CUERPO_VISTAS = 512;

type Pedido = { readonly alertaId: string } | { readonly todas: true };

function leerPedido(valor: unknown): Pedido | null {
  const una = objetoConClaves(valor, ["alertaId"]);
  if (una !== null) return typeof una["alertaId"] === "string" && ID_ALERTA.test(una["alertaId"]) ? { alertaId: una["alertaId"] } : null;
  const todas = objetoConClaves(valor, ["todas"]);
  return todas !== null && todas["todas"] === true ? { todas: true } : null;
}

/**
 * POST /api/alertas/vistas · «Marcar vista» ({ alertaId }) y «Marcar todas» ({ todas: true }), solo del dueño, con la protección de
 * /api/operar/tarifas: Origin de la lista (CSRF) → guardián del dueño (la familia, 403) → cuerpo JSON acotado con claves exactas.
 * El usuario sale de la sesión. Idempotente: marcar lo ya marcado responde 200 con cero marcadas; una alerta que no existe, 404. Sin
 * caché; errores genéricos, sin valores.
 */
export async function POST(pedido: Request): Promise<Response> {
  const rechazo = origenRechazado(pedido);
  if (rechazo) return rechazo;
  try {
    const sesion = await exigirDuenoApi(pedido);
    if (!sesion.ok) return sesion.respuesta;
    const cuerpo = await leerCuerpoJson(pedido, MAX_CUERPO_VISTAS);
    if (!cuerpo.ok) return respuestaSolicitudInvalida();
    const leido = leerPedido(cuerpo.valor);
    if (leido === null) return respuestaSolicitudInvalida();
    if ("todas" in leido) return respuestaJson(await marcarTodas(db, sesion.usuario.id, fechaEnBogota(new Date())), 200);
    const r = await marcarVista(db, leido.alertaId, sesion.usuario.id);
    return r.existe ? respuestaJson({ marcadas: r.marcadas }, 200) : respuestaJson({ error: MENSAJE_NO_EXISTE, codigo: "ALERTA_INEXISTENTE" }, 404);
  } catch (error) {
    console.error(`[alertas:vistas] no se pudo marcar (${error instanceof Error ? error.name : "desconocido"})`);
    return respuestaJson({ error: MENSAJE_FALLO }, 500);
  }
}
