/**
 * Guarda las alertas que detectó el motor (tabla `alerta`, de solo inserción). Cada fila lleva solo la EVIDENCIA (precio,
 * nivel, variación, umbral, hora y fuente del dato, versión de umbrales y del motor), sin texto libre y sin montos del
 * portafolio: el texto lo reescribe `textoDeAlerta` al mostrarla. Las deduplica la base (índices únicos de la migración
 * *_alertas) y se inserta con `skipDuplicates` (ON CONFLICT DO NOTHING): correr dos veces lo mismo inserta 0. Si el lote
 * falla por una RESTRICCIÓN de la base (una CHECK, una llave o una unicidad: una fila mala), guarda de a una para no perder las
 * demás y cuenta la fallida. Un error de conexión, de tiempo o de permiso (P1001, P1002, P1017, 42501…) se propaga: el script sale
 * con 1. El mensaje del error (puede traer la fila) no se guarda ni se muestra; al registro solo va su código (`codigoDeError`).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { Procedencia } from "./leer-entrada";
import type { Alerta } from "./tipos";
import type { Umbrales } from "./umbrales";

/** La versión del motor que escribe la fila (CHECK alerta_motor_chk). */
export const MOTOR_VERSION = "alertas-v1";

export interface ContextoGuardado {
  readonly umbrales: Umbrales;
  readonly umbralVersionId: string | null;
  readonly procedencia: ReadonlyMap<string, Procedencia>;
}

export interface ResultadoGuardado {
  readonly evaluadas: number;
  readonly insertadas: number;
  readonly duplicadas: number;
  readonly fallidas: number;
}

const decimal = (d: Prisma.Decimal | undefined): Prisma.Decimal | null => d ?? null;

/** El umbral que disparó la alerta (porcentaje, minutos o días hábiles); el nivel cruzado y la falta del cierre no tienen. */
function umbralDe(a: Alerta, u: Umbrales): number | null {
  switch (a.tipo) {
    case "NIVEL_CERCA": return u.alertaCercaPct;
    case "MOVIMIENTO_DIA": return u.alertaMovimientoPct;
    case "CAIDA_PORTAFOLIO": return u.alertaCaidaPct;
    case "FECHA_EX": return u.alertaExDiasHabiles;
    case "DATO_VIEJO": return a.base === "CIERRE" ? null : (a.datos.umbralMin ?? u.alertaDatoViejoMin);
    case "NIVEL_CRUZADO": return null;
  }
}

/**
 * Hora de traída y fuente del dato que causó la alerta: el cierre de hoy o la barra de la alerta. Sin especie, sin dato o sin
 * barra (la alerta dice que no hay ninguna de hoy; la última que existe es de otro día), null: no se inventa procedencia.
 */
function procedenciaDe(a: Alerta, procedencia: ReadonlyMap<string, Procedencia>): { traidoEn: Date; fuente: string } | null {
  if (a.instrumentoId === null || a.base === null) return null;
  const p = procedencia.get(a.instrumentoId);
  if (a.base === "CIERRE") return p?.cierre ?? null;
  const instante = a.datos.instante;
  return instante !== undefined && p?.intradia?.instante.getTime() === instante.getTime() ? p.intradia : null;
}

export function filaDeAlerta(a: Alerta, ctx: ContextoGuardado): Prisma.AlertaUncheckedCreateInput {
  const umbral = umbralDe(a, ctx.umbrales);
  const origen = procedenciaDe(a, ctx.procedencia);
  const esFecha = a.tipo === "FECHA_EX";
  return {
    dia: new Date(`${a.dia}T00:00:00.000Z`),
    tipo: a.tipo,
    instrumentoId: a.instrumentoId,
    // En el motor, el id de la regla de FECHA_EX es el del decreto: la base lo guarda en su columna.
    reglaId: esFecha ? null : a.reglaId,
    decretoId: esFecha ? a.reglaId : null,
    sentido: a.sentido,
    base: a.base,
    precio: decimal(a.datos.precio),
    referencia: decimal(a.datos.nivel),
    // Una sola columna para dos cosas: la variación con signo (movimiento y caída) o, en NIVEL_CERCA, la distancia al nivel; el tipo dice cuál.
    variacionPct: decimal(a.datos.variacionPct ?? a.datos.distanciaPct),
    umbral,
    instanteDato: a.datos.instante ?? null,
    traidoEn: origen?.traidoEn ?? null,
    fuente: origen?.fuente ?? null,
    conRetraso: a.datos.conRetraso ?? null,
    minutosDeEdad: a.datos.minutosDeEdad ?? null,
    esFechaEx: a.datos.esFechaEx ?? null,
    umbralVersionId: ctx.umbralVersionId,
    motorVersion: MOTOR_VERSION,
  };
}

/** El código para el registro: el de Prisma (P…) o el SQLSTATE que trae el mensaje de una consulta cruda; nunca el mensaje. */
export function codigoDeError(e: unknown): string | null {
  if (typeof e !== "object" || e === null) return null;
  const code = (e as { code?: unknown }).code;
  if (typeof code === "string" && /^[A-Z0-9]{3,6}$/.test(code)) return code;
  const m = /code: "([0-9A-Z]{5})"/.exec(String((e as { message?: unknown }).message ?? ""));
  return m === null ? null : m[1]!;
}

const CODIGOS_DE_RESTRICCION = new Set(["P2002", "P2003", "P2004"]);
/** Una fila que la base rechaza por una restricción (Prisma P2002/P2003/P2004 o un SQLSTATE de la clase 23, p. ej. la CHECK 23514). */
const esDeRestriccion = (e: unknown): boolean => {
  const c = codigoDeError(e);
  return c !== null && (CODIGOS_DE_RESTRICCION.has(c) || c.startsWith("23"));
};

const esUnica = (e: unknown): boolean => typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";

export async function guardarAlertas(db: Pick<PrismaClient, "alerta">, alertas: readonly Alerta[], ctx: ContextoGuardado): Promise<ResultadoGuardado> {
  const filas = alertas.map((a) => filaDeAlerta(a, ctx));
  if (filas.length === 0) return { evaluadas: 0, insertadas: 0, duplicadas: 0, fallidas: 0 };
  try {
    const { count } = await db.alerta.createMany({ data: filas, skipDuplicates: true });
    return { evaluadas: filas.length, insertadas: count, duplicadas: filas.length - count, fallidas: 0 };
  } catch (e) {
    // Solo una fila mala se resuelve de a una; la conexión o el permiso caídos suben al script (salida 1).
    if (!esDeRestriccion(e)) throw e;
  }
  let insertadas = 0;
  let duplicadas = 0;
  let fallidas = 0;
  for (const data of filas) {
    try {
      await db.alerta.create({ data, select: { id: true } });
      insertadas += 1;
    } catch (e) {
      if (esUnica(e) || codigoDeError(e) === "23505") duplicadas += 1;
      else if (esDeRestriccion(e)) fallidas += 1;
      else throw e;
    }
  }
  return { evaluadas: filas.length, insertadas, duplicadas, fallidas };
}
