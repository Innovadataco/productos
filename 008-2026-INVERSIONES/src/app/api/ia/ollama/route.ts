import { exigirDuenoApi } from "@/auth/sesion";
import { respuestaJson } from "@/auth/respuestas";
import { permitidoOllama, tomarTurnoOllama } from "@/ia/config/frecuencia";
import { leerConfigIa } from "@/ia/config/leer";
import { identificarGuardado, probarGuardado, sondaDelEntorno, type ResultadoIdentificar, type ResultadoProbar } from "@/ia/config/sonda-ollama";
import { LISTA_MODELOS_PI } from "@/ia/local/modelos";
import { db } from "@/lib/db";
import { leerCuerpoJson, origenRechazado, respuestaSolicitudInvalida } from "@/plan/edicion/http";

export const dynamic = "force-dynamic";

const ACCIONES = ["identificar", "probar"] as const;
type Accion = (typeof ACCIONES)[number];
/** El cuerpo solo trae la acción: cabe de sobra en esto. */
const MAX_CUERPO = 1024;

const accionDe = (valor: unknown): Accion | null => {
  const accion = typeof valor === "object" && valor !== null ? (valor as { readonly accion?: unknown }).accion : undefined;
  return ACCIONES.find((a) => a === accion) ?? null;
};

/** El estado HTTP de un resultado: inalcanzable, 503 estructurado (como en PI); un error del Ollama, 502; lo demás, 200. */
function respuestaDe(accion: Accion, resultado: ResultadoIdentificar | ResultadoProbar): Response {
  if (resultado.estado === "INALCANZABLE") return respuestaJson({ accion, error: "Ollama inalcanzable", resultado }, 503);
  if (resultado.estado === "ERROR") return respuestaJson({ accion, error: "Respuesta inválida de Ollama", resultado }, 502);
  return respuestaJson({ accion, resultado }, 200);
}

/**
 * POST /api/ia/ollama · «Identificar modelos» o «Probar» de /edicion/ia, solo del dueño (E8), con la protección de envío
 * de /edicion/plan, un pedido cada pocos segundos por usuario y una sola acción al Mac a la vez en el proceso. Usa SOLO el destino GUARDADO en la configuración
 * vigente (I-24 de PI, un SSRF): del cuerpo se lee únicamente la acción; cualquier destino que venga ahí se ignora y no
 * llega a la sonda. Un Ollama inalcanzable es un 503 ESTRUCTURADO, nunca un 500. En producción la sonda es la pendiente:
 * la app no llega a la tailnet y la conexión la hará el servicio de IA (E6). Sin caché.
 */
export async function POST(pedido: Request): Promise<Response> {
  const rechazo = origenRechazado(pedido);
  if (rechazo) return rechazo;
  try {
    const sesion = await exigirDuenoApi(pedido);
    if (!sesion.ok) return sesion.respuesta;
    const frecuencia = permitidoOllama(sesion.usuario.id, Date.now());
    if (!frecuencia.permitido) return respuestaJson({ error: "Demasiadas solicitudes" }, 429, { "Retry-After": String(frecuencia.reintentarEnS) });
    const cuerpo = await leerCuerpoJson(pedido, MAX_CUERPO);
    const accion = cuerpo.ok ? accionDe(cuerpo.valor) : null;
    if (accion === null) return respuestaSolicitudInvalida();
    const soltar = tomarTurnoOllama();
    if (soltar === null) return respuestaJson({ error: "Demasiadas solicitudes" }, 429, { "Retry-After": "5" });
    try {
      const config = await leerConfigIa(db);
      const sonda = sondaDelEntorno(process.env);
      const resultado = accion === "identificar" ? await identificarGuardado(config, sonda, LISTA_MODELOS_PI) : await probarGuardado(config, sonda);
      return respuestaDe(accion, resultado);
    } finally {
      soltar();
    }
  } catch (error) {
    console.error(`[edicion:ia-ollama] la sonda no se pudo completar (${error instanceof Error ? error.name : "desconocido"})`);
    return respuestaJson({ error: "No se pudo completar la sonda de Ollama", resultado: { estado: "ERROR", detalle: "EXCEPCION_INTERNA" } }, 502);
  }
}
