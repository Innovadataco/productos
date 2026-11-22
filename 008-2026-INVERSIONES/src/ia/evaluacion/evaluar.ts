/**
 * El bucle del arnés (E7) para UN modelo, en serie (un pedido a la vez: PI tiene la prioridad en el Mac):
 * 1. revisa las opciones (RangeError, antes de cualquier red);
 * 2. la sonda (solo GET de tags: el modelo está con su digest aprobado); si falla, SIN_MODELO y no genera nada;
 * 3. dos pasadas completas (todos los casos y después todos otra vez: la segunda mide la repetición sin el sesgo de
 *    pedir lo mismo dos veces seguidas), con una pausa entre pedidos;
 * 4. anota cada corrida apenas termina (sobrevive a un corte);
 * 5. corta tras MAX_FALLOS_SEGUIDOS fallos seguidos de modelo o de tiempo (el Mac no responde: no se insiste), y con la
 *    señal del operador (PARA), en el acto.
 */
import { LIMITE_MAX_MS, LIMITE_MIN_MS, PATRON_MODELO, type Generador } from "../generador";
import type { ResultadoSondaLocal } from "../local/sonda";
import { correrCaso } from "./corrida";
import { PASADAS, type CasoEvaluacion, type EstadoFin, type FinEvaluacion, type Pasada, type RegistroCorrida } from "./tipos";

export const MAX_FALLOS_SEGUIDOS = 3;
export const MAX_PAUSA_MS = 60_000;
const MOTIVOS_QUE_CORTAN: ReadonlySet<string> = new Set(["MODELO_NO_DISPONIBLE", "TIEMPO_AGOTADO"]);

export interface OpcionesEvaluacion {
  readonly casos: readonly CasoEvaluacion[];
  readonly modelo: string;
  readonly pasadas: Pasada;
  readonly limiteMs: number;
  readonly pausaMs: number;
}

export interface DependenciasEvaluacion {
  readonly generador: Generador;
  /** La sonda de la puerta local sin smoke (solo tags): `generador.sondaLocal({ smoke: false, limiteMs }, senal)`. */
  readonly sondear: (limiteMs: number, senal: AbortSignal) => Promise<ResultadoSondaLocal>;
  readonly reloj: () => number;
  readonly ahoraIso: () => string;
  /** La pausa entre pedidos (se corta con la señal). */
  readonly esperar: (ms: number, senal: AbortSignal) => Promise<void>;
  /** La señal del operador (PARA). */
  readonly senal: AbortSignal;
  readonly anotar: (registro: RegistroCorrida) => void;
}

function revisar(o: OpcionesEvaluacion): void {
  const valido = o.casos.length > 0 && (PASADAS as readonly number[]).includes(o.pasadas) && typeof o.modelo === "string" && PATRON_MODELO.test(o.modelo)
    && Number.isInteger(o.limiteMs) && o.limiteMs >= LIMITE_MIN_MS && o.limiteMs <= LIMITE_MAX_MS
    && Number.isInteger(o.pausaMs) && o.pausaMs >= 0 && o.pausaMs <= MAX_PAUSA_MS;
  if (!valido) throw new RangeError("Opciones de la evaluación fuera de rango.");
}

const fin = (estado: EstadoFin, corridas: number, motivo: string | null = null, detalle: string | null = null): FinEvaluacion =>
  Object.freeze({ estado, corridas, motivo, detalle });

export async function evaluarModelo(o: OpcionesEvaluacion, d: DependenciasEvaluacion): Promise<FinEvaluacion> {
  revisar(o);
  if (d.senal.aborted) return fin("CORTADA_POR_SENAL", 0);
  const sonda = await d.sondear(o.limiteMs, d.senal);
  if (d.senal.aborted) return fin("CORTADA_POR_SENAL", 0);
  if (!sonda.ok) return fin("SIN_MODELO", 0, sonda.motivo, sonda.detalle);
  let orden = 0;
  let seguidos = 0;
  for (const pasada of PASADAS.filter((p) => p <= o.pasadas)) {
    for (const caso of o.casos) {
      if (orden > 0 && o.pausaMs > 0) await d.esperar(o.pausaMs, d.senal);
      if (d.senal.aborted) return fin("CORTADA_POR_SENAL", orden);
      orden += 1;
      const r = await correrCaso({ caso, modelo: o.modelo, pasada, orden, generador: d.generador, limiteMs: o.limiteMs, senal: d.senal, reloj: d.reloj, ahoraIso: d.ahoraIso });
      d.anotar(r);
      if (r.estado === "CORTADO") return fin("CORTADA_POR_SENAL", orden);
      seguidos = r.estado === "FALLIDO" && MOTIVOS_QUE_CORTAN.has(r.motivos[0] ?? "") ? seguidos + 1 : 0;
      if (seguidos >= MAX_FALLOS_SEGUIDOS) return fin("CORTADA_POR_FALLOS", orden, r.motivos[0] ?? null, r.detalle);
    }
  }
  return fin("COMPLETA", orden);
}
