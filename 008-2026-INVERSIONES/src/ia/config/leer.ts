import "server-only";
/**
 * La configuración de la IA en la base (E8):
 * - `leerConfigIa(db)`: la vigente (la de mayor versión), SOLO con las columnas que inv_ia puede leer (ni el motivo ni el
 *   autor), revisada otra vez al leer (`filaAConfig`): una fila que no cuadra da null, y null es «apagada». La usan la
 *   pantalla y el servicio de los resúmenes.
 * - `leerHistoriaConfigIa(db, n)`: las últimas versiones con su motivo, su autor y la hora de la base; solo la pantalla
 *   (inv_app).
 * Los decimales de Prisma pasan a enteros: la temperatura en centésimas y el tope en micro-USD.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { esDe, esObjetoPlano, soloCampos } from "../formas";
import { leerDestinoLocal } from "../local/destino";
import { ESFUERZOS_NUBE, MODELOS_NUBE, type EsfuerzoNube, type ModeloNube } from "../nube/peticion";
import { MODOS_PUERTAS, type ModoPuertas } from "../puertas";
import {
  HORAS_RESUMEN, LIMITE_MAX_BD_S, LIMITE_MAX_S, LIMITE_MIN_S, TAREAS_IA, TEMPERATURA_MAX_CENTESIMAS, TOPE_MAX_MICRO_USD, TOPE_MIN_MICRO_USD, type HoraResumen, type TareaIa,
} from "./parametros";
import type { TareaConfig, TareasConfig } from "./pedido";

export type { TareaConfig, TareasConfig } from "./pedido";

export interface ConfigIaVigente {
  readonly id: string;
  readonly version: number;
  readonly modo: ModoPuertas;
  readonly ollamaHost: string | null;
  readonly ollamaPuerto: number | null;
  readonly temperaturaCentesimas: number;
  readonly tareas: TareasConfig;
  readonly modeloNube: ModeloNube;
  readonly esfuerzoNube: EsfuerzoNube;
  readonly topeMicroUsd: bigint | null;
  readonly horaResumen: HoraResumen;
  readonly limiteSegundos: number;
  /** El interruptor del botón «Analizar con IA» (apagado por omisión). */
  readonly analisisDemanda: boolean;
  readonly creadaEn: Date;
}

/** Lo que se selecciona de config_ia (las columnas de inv_ia). */
export const SELECCION_CONFIG_IA = Object.freeze({
  id: true, version: true, modo: true, ollamaHost: true, ollamaPuerto: true, temperaturaLocal: true, tareas: true, modeloNube: true, topeMensualUsd: true,
  horaResumen: true, limiteSegundos: true, analisisDemanda: true, esfuerzoNube: true, creadaEn: true,
} as const);
export type FilaConfigIa = Prisma.ConfigIaGetPayload<{ select: typeof SELECCION_CONFIG_IA }>;

type Db = Pick<PrismaClient, "configIa">;

const CAMPOS_TAREA: readonly string[] = Object.freeze(["activo", "modeloLocal"]);
const SIN_TAREA: TareaConfig = Object.freeze({ activo: false, modeloLocal: null });
const CENTESIMAS = /^([01])\.([0-9]{2})$/;
const USD = /^([0-9]{1,2})(?:\.([0-9]{1,2}))?$/;

/** Un Decimal de 0 a 1 en centésimas; null si no tiene la forma. */
function centesimas(valor: Prisma.Decimal): number | null {
  const m = CENTESIMAS.exec(valor.toFixed(2));
  if (m === null) return null;
  const n = Number(m[1]) * 100 + Number(m[2]);
  return n <= TEMPERATURA_MAX_CENTESIMAS ? n : null;
}

/** Un Decimal en USD con dos decimales como micro-USD; null si no tiene la forma o el rango. */
function microUsd(valor: Prisma.Decimal): bigint | null {
  const m = USD.exec(valor.toFixed(2));
  if (m === null) return null;
  const micro = BigInt(m[1]!) * 1_000_000n + BigInt((m[2] ?? "").padEnd(2, "0")) * 10_000n;
  return micro >= TOPE_MIN_MICRO_USD && micro <= TOPE_MAX_MICRO_USD ? micro : null;
}

function tareaDe(valor: unknown): TareaConfig | null {
  if (valor === undefined) return SIN_TAREA;
  if (!esObjetoPlano(valor) || !soloCampos(valor, CAMPOS_TAREA) || typeof valor.activo !== "boolean") return null;
  const { modeloLocal } = valor;
  if (modeloLocal !== undefined && modeloLocal !== null && typeof modeloLocal !== "string") return null;
  return Object.freeze({ activo: valor.activo, modeloLocal: typeof modeloLocal === "string" ? modeloLocal : null });
}

/** Las tareas guardadas; la que falta (una versión vieja frente a una tarea nueva) queda inactiva. */
function tareasDe(valor: unknown): TareasConfig | null {
  if (!esObjetoPlano(valor) || !soloCampos(valor, TAREAS_IA)) return null;
  const leidas = TAREAS_IA.map((t) => [t, tareaDe(valor[t])] as const);
  if (leidas.some(([, x]) => x === null)) return null;
  return Object.freeze(Object.fromEntries(leidas) as Record<TareaIa, TareaConfig>);
}

function destinoValido(host: string | null, puerto: number | null): boolean {
  if (host === null || puerto === null) return host === null && puerto === null;
  try {
    leerDestinoLocal(`http://${host}:${puerto}`);
    return true;
  } catch {
    return false;
  }
}

/** La fila como la vigente, revisada; null si algo no cuadra (cierra en «apagada»). Pura. */
export function filaAConfig(fila: FilaConfigIa): ConfigIaVigente | null {
  const { modo, modeloNube, esfuerzoNube, horaResumen, limiteSegundos, ollamaHost, ollamaPuerto } = fila;
  const tareas = tareasDe(fila.tareas);
  const temperaturaCentesimas = centesimas(fila.temperaturaLocal);
  const topeMicroUsd = fila.topeMensualUsd === null ? null : microUsd(fila.topeMensualUsd);
  const valido = esDe(MODOS_PUERTAS, modo) && esDe(MODELOS_NUBE, modeloNube) && esDe(ESFUERZOS_NUBE, esfuerzoNube) && esDe(HORAS_RESUMEN, horaResumen)
    && Number.isInteger(limiteSegundos) && limiteSegundos >= LIMITE_MIN_S && limiteSegundos <= LIMITE_MAX_BD_S && typeof fila.analisisDemanda === "boolean"
    && tareas !== null && temperaturaCentesimas !== null && (fila.topeMensualUsd === null || topeMicroUsd !== null) && destinoValido(ollamaHost, ollamaPuerto);
  if (!valido) return null;
  return Object.freeze({
    id: fila.id, version: fila.version, modo, ollamaHost, ollamaPuerto, temperaturaCentesimas, tareas, modeloNube, esfuerzoNube, topeMicroUsd, horaResumen,
    // Una versión vieja puede traer hasta 120 s: el servicio nunca espera más de 60 (condición de PI).
    limiteSegundos: Math.min(limiteSegundos, LIMITE_MAX_S), analisisDemanda: fila.analisisDemanda, creadaEn: fila.creadaEn,
  });
}

/** El destino guardado como lo pide la puerta local (`http://<host>:<puerto>`), o null. */
export function destinoDe(config: ConfigIaVigente | null): string | null {
  if (config === null || config.ollamaHost === null || config.ollamaPuerto === null) return null;
  return `http://${config.ollamaHost}:${config.ollamaPuerto}`;
}

/** La vigente (la de mayor versión), o null si no hay ninguna o no cuadra. */
export async function leerConfigIa(db: Db): Promise<ConfigIaVigente | null> {
  const fila = await db.configIa.findFirst({ orderBy: { version: "desc" }, select: SELECCION_CONFIG_IA });
  if (fila === null) return null;
  const config = filaAConfig(fila);
  if (config === null) console.error("[ia-config] la versión vigente no cuadra con las listas: la IA queda apagada");
  return config;
}

export interface VersionHistoria {
  readonly version: number;
  readonly modo: string;
  readonly motivo: string;
  readonly autor: string;
  readonly creadaEn: Date;
}

/** Las últimas `n` versiones, de la más nueva a la más vieja, con su motivo y su autor (solo la pantalla). */
export async function leerHistoriaConfigIa(db: Db, n: number): Promise<readonly VersionHistoria[]> {
  const filas = await db.configIa.findMany({
    orderBy: { version: "desc" },
    take: n,
    select: { version: true, modo: true, motivo: true, creadaEn: true, autor: { select: { email: true } } },
  });
  return Object.freeze(filas.map((f) => Object.freeze({ version: f.version, modo: f.modo, motivo: f.motivo, autor: f.autor.email, creadaEn: f.creadaEn })));
}
