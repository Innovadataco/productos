/**
 * Las sondas de la puerta local, como las de PI (`ollama_ping` y `ollama_smoke`):
 * - ping: GET /api/tags responde y el modelo aprobado está con su digest. NO toma el turno: no carga el modelo, y un
 *   ping durante una generación larga no debe dar una caída falsa;
 * - smoke (si se pide): una generación mínima (`cuerpoSmoke`) con el turno, como cualquier pedido al Mac. Vale con
 *   `response` o con `thinking`, aunque pare por el tope de tokens; otra finalización es FINALIZACION_INESPERADA.
 * Con el digest por verificar, la sonda dice DIGEST_POR_VERIFICAR sin tocar la red. Opciones inválidas son un defecto
 * del código: rechaza con `ErrorLocal`. Lo demás nunca rechaza: vuelve con la etapa, el motivo y el detalle.
 */
import { LIMITE_MAX_MS, LIMITE_MIN_MS } from "../generador";
import { esObjetoPlano, soloCampos } from "../formas";
import { consultarModelo, pedirGeneracion, tomarTurno, type ContextoLocal } from "./contexto";
import { ErrorLocal, falloLocal, type DetalleDe, type FalloLocal, type MotivoLocal } from "./errores";
import { cuerpoSmoke } from "./ollama";
import { abrirPlazo } from "./plazo";
import type { Liberar } from "./semaforo";

export interface OpcionesSonda {
  readonly smoke: boolean;
  /** El límite de toda la sonda, como el del contrato (entero, de LIMITE_MIN_MS a LIMITE_MAX_MS). */
  readonly limiteMs: number;
}

export type EtapaSonda = "PING" | "SMOKE";

export type ResultadoSondaLocal =
  | { readonly ok: true; readonly smoke: "OK" | "NO_PEDIDO"; readonly latenciaMs: number }
  | { readonly ok: false; readonly etapa: EtapaSonda; readonly motivo: MotivoLocal; readonly detalle: DetalleDe<MotivoLocal>; readonly latenciaMs: number };

const CAMPOS_OPCIONES: readonly string[] = Object.freeze(["smoke", "limiteMs"]);

function revisarOpciones(opciones: unknown): OpcionesSonda {
  if (!esObjetoPlano(opciones) || !soloCampos(opciones, CAMPOS_OPCIONES) || typeof opciones.smoke !== "boolean") throw new ErrorLocal("CONFIGURACION_INVALIDA");
  const { limiteMs } = opciones;
  if (typeof limiteMs !== "number" || !Number.isInteger(limiteMs) || limiteMs < LIMITE_MIN_MS || limiteMs > LIMITE_MAX_MS) throw new ErrorLocal("LIMITE_INVALIDO");
  return { smoke: opciones.smoke, limiteMs };
}

const fallida = (etapa: EtapaSonda, fallo: FalloLocal, latenciaMs: number): ResultadoSondaLocal =>
  Object.freeze({ ok: false, etapa, motivo: fallo.motivo, detalle: fallo.detalle, latenciaMs });

interface Avance {
  etapa: EtapaSonda;
}

/** Los pasos de la sonda con su plazo; libera el turno y cierra el plazo al salir. Anota en `avance` la etapa. */
async function pasos(contexto: ContextoLocal, digest: string, smoke: boolean, limiteMs: number, senal: AbortSignal | undefined, avance: Avance): Promise<ResultadoSondaLocal> {
  const plazo = abrirPlazo(senal, limiteMs);
  let liberar: Liberar | null = null;
  try {
    const inicio = contexto.ahora();
    const latencia = (): number => Math.max(0, contexto.ahora() - inicio);
    const modelo = await consultarModelo(contexto, digest, plazo);
    if (!modelo.ok) return fallida("PING", modelo, latencia());
    if (!smoke) return Object.freeze({ ok: true, smoke: "NO_PEDIDO", latenciaMs: latencia() });
    avance.etapa = "SMOKE";
    const turno = await tomarTurno(contexto, plazo);
    if (typeof turno !== "function") return fallida("SMOKE", turno, latencia());
    liberar = turno;
    const respuesta = await pedirGeneracion(contexto, cuerpoSmoke(contexto.nombre), plazo);
    if (!respuesta.ok) return fallida("SMOKE", respuesta, latencia());
    if (respuesta.generacion.finalizacion === "OTRA") return fallida("SMOKE", falloLocal("ERROR_PROVEEDOR", "FINALIZACION_INESPERADA"), latencia());
    return Object.freeze({ ok: true, smoke: "OK", latenciaMs: latencia() });
  } finally {
    liberar?.();
    plazo.cerrar();
  }
}

export async function sondear(contexto: ContextoLocal, opciones: OpcionesSonda, senal?: AbortSignal): Promise<ResultadoSondaLocal> {
  const { smoke, limiteMs } = revisarOpciones(opciones);
  const { digest } = contexto;
  if (digest === null) return fallida("PING", falloLocal("MODELO_NO_DISPONIBLE", "DIGEST_POR_VERIFICAR"), 0);
  if (senal?.aborted === true) return fallida("PING", falloLocal("TIEMPO_AGOTADO", "SENAL_ABORTADA"), 0);
  const avance: Avance = { etapa: "PING" };
  try {
    return await pasos(contexto, digest, smoke, limiteMs, senal, avance);
  } catch {
    return fallida(avance.etapa, falloLocal("ERROR_PROVEEDOR", "EXCEPCION_INTERNA"), 0);
  }
}
