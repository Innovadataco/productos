import { exigirDuenoApi } from "@/auth/sesion";
import { respuestaJson } from "@/auth/respuestas";
import { clienteAnalisisDelEntorno, type MotivoAnalisis } from "@/ia/config/analisis-servicio";
import { permitidoAnalisis } from "@/ia/config/frecuencia";
import { leerConfigIa } from "@/ia/config/leer";
import { TAREAS_IA } from "@/ia/config/parametros";
import { esDe } from "@/ia/formas";
import { db } from "@/lib/db";
import { leerCuerpoJson, origenRechazado, respuestaSolicitudInvalida } from "@/plan/edicion/http";

export const dynamic = "force-dynamic";

/** El cuerpo es solo `{"tarea": "…"}`: cabe de sobra en esto. */
const MAX_CUERPO = 256;
const CLAVES = ["tarea"];

/** Cada motivo del servicio con su estado HTTP y su código para la pantalla (que lo dice con un texto fijo). */
const POR_MOTIVO: Readonly<Record<MotivoAnalisis, readonly [number, string]>> = Object.freeze({
  ANALISIS_APAGADO: [403, "ANALISIS_APAGADO"],
  TAREA_INACTIVA: [409, "TAREA_INACTIVA"],
  OCUPADO: [429, "OCUPADO"],
  ESPERA_MINIMA: [429, "ESPERA_MINIMA"],
  SERVICIO_TOKEN: [503, "SERVICIO_NO_DISPONIBLE"],
  SERVICIO_NO_DISPONIBLE: [503, "SERVICIO_NO_DISPONIBLE"],
  RESPUESTA_INVALIDA: [502, "RESPUESTA_INVALIDA"],
});
const MENSAJE = "No se pudo pedir el análisis.";

const sinServicio = (): Response => respuestaJson({ error: MENSAJE, codigo: "SERVICIO_NO_DISPONIBLE" }, 503);

/** La tarea del cuerpo: un objeto con EXACTAMENTE la clave «tarea», de la lista cerrada; null si no. */
function tareaDe(valor: unknown): (typeof TAREAS_IA)[number] | null {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return null;
  const claves = Object.keys(valor);
  if (claves.length !== CLAVES.length || !claves.every((c) => CLAVES.includes(c))) return null;
  const tarea = (valor as { readonly tarea?: unknown }).tarea;
  return esDe(TAREAS_IA, tarea) ? tarea : null;
}

/**
 * POST /api/ia/analizar · «Analizar con IA»: le pide al servicio inv-008-ia el análisis de UNA tarea, solo del dueño.
 * Origin de la lista (CSRF) → guardián del dueño (la familia, 403) → un pedido cada pocos segundos por usuario → cuerpo
 * JSON acotado con la clave exacta «tarea» de la lista cerrada → el interruptor de config_ia (apagado por omisión: sin
 * configuración o apagado, 403 sin llamar al servicio) → el servicio, que decide lo demás (1 en curso y 1 en espera,
 * 2 minutos entre análisis, 60 s por pedido) y responde enseguida: 202 con el lugar, o el motivo del descarte. Del
 * cuerpo solo se lee la tarea: el modelo y el destino son los guardados. Sin caché; errores genéricos.
 */
export async function POST(pedido: Request): Promise<Response> {
  const rechazo = origenRechazado(pedido);
  if (rechazo) return rechazo;
  try {
    const sesion = await exigirDuenoApi(pedido);
    if (!sesion.ok) return sesion.respuesta;
    const frecuencia = permitidoAnalisis(sesion.usuario.id, Date.now());
    if (!frecuencia.permitido) return respuestaJson({ error: "Demasiadas solicitudes" }, 429, { "Retry-After": String(frecuencia.reintentarEnS) });
    const cuerpo = await leerCuerpoJson(pedido, MAX_CUERPO);
    const tarea = cuerpo.ok ? tareaDe(cuerpo.valor) : null;
    if (tarea === null) return respuestaSolicitudInvalida();
    const config = await leerConfigIa(db);
    if (config === null || !config.analisisDemanda) return respuestaJson({ error: MENSAJE, codigo: "ANALISIS_APAGADO" }, 403);
    const cliente = clienteAnalisisDelEntorno(process.env);
    if (cliente === null) return sinServicio();
    let r: Awaited<ReturnType<typeof cliente.pedir>>;
    try {
      r = await cliente.pedir(tarea);
    } catch (error) {
      console.error(`[ia-analizar] el servicio no respondió bien (${error instanceof Error ? error.name : "desconocido"})`);
      return respuestaJson({ error: MENSAJE, codigo: "RESPUESTA_INVALIDA" }, 502);
    }
    if (r.ok) return respuestaJson({ estado: "ACEPTADO", lugar: r.lugar }, 202);
    const [estado, codigo] = POR_MOTIVO[r.motivo];
    const cabeceras: Record<string, string> = r.reintentarEnS === undefined ? {} : { "Retry-After": String(r.reintentarEnS) };
    return respuestaJson(r.reintentarEnS === undefined ? { error: MENSAJE, codigo } : { error: MENSAJE, codigo, reintentarEnS: r.reintentarEnS }, estado, cabeceras);
  } catch (error) {
    console.error(`[ia-analizar] no se pudo pedir el análisis (${error instanceof Error ? error.name : "desconocido"})`);
    return respuestaJson({ error: MENSAJE, codigo: "ERROR_INTERNO" }, 500);
  }
}

/**
 * GET /api/ia/analizar · el estado del análisis a demanda (qué corre, qué espera, cuánto falta para poder pedir otro),
 * solo del dueño: la pantalla lo sondea mientras dice «Analizando…». No escribe nada. Sin caché.
 */
export async function GET(pedido: Request): Promise<Response> {
  try {
    const sesion = await exigirDuenoApi(pedido);
    if (!sesion.ok) return sesion.respuesta;
    const cliente = clienteAnalisisDelEntorno(process.env);
    if (cliente === null) return sinServicio();
    const lectura = await cliente.estado();
    return lectura.ok ? respuestaJson({ estado: lectura.estado }, 200) : sinServicio();
  } catch (error) {
    console.error(`[ia-analizar] no se pudo leer el estado (${error instanceof Error ? error.name : "desconocido"})`);
    return respuestaJson({ error: MENSAJE, codigo: "ERROR_INTERNO" }, 500);
  }
}
