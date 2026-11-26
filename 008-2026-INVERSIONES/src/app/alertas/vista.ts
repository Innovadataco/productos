/**
 * De la fila guardada (tabla `alerta`) a lo que /alertas muestra. Puro: sin base ni Next. El texto NO se guarda: se reescribe
 * con `textoDeAlerta` (src/alertas/texto.ts) desde la evidencia de la fila, el mismo que escribió el motor. La procedencia de
 * cada dato (de dónde y cuándo) sale de su fuente y de su hora de traída y se pinta con FechaDato; donde no hay un dato único
 * (la caída del portafolio, la fecha ex, la falta de datos) no se inventa. Las horas, en Colombia (UTC−5).
 */
import type { Prisma } from "@prisma/client";
import { textoDeAlerta } from "@/alertas/texto";
import { TIPOS_ALERTA, claveDeAlerta, type Alerta, type BasePrecio, type SentidoAlerta, type TipoAlerta } from "@/alertas/tipos";
import { diaIso } from "@/precios/horario";
import { horaColombia } from "../_comun/fecha-dato/hora";
import type { Procedencia } from "../_comun/fecha-dato/tipos";
import { fecha } from "../tablero/formato";

/** Una fila de `alerta` con lo que trae su lectura: la especie (nemotécnico), las fechas del decreto y la marca de vista. */
export interface FilaAlerta {
  readonly id: string;
  readonly dia: Date;
  readonly tipo: string;
  readonly nemotecnico: string | null;
  readonly fechaExDecreto: Date | null;
  readonly fechaPagoDecreto: Date | null;
  readonly sentido: string | null;
  readonly base: string | null;
  readonly precio: Prisma.Decimal | null;
  readonly referencia: Prisma.Decimal | null;
  readonly variacionPct: Prisma.Decimal | null;
  readonly umbral: Prisma.Decimal | null;
  readonly instanteDato: Date | null;
  readonly traidoEn: Date | null;
  readonly fuente: string | null;
  readonly conRetraso: boolean | null;
  readonly minutosDeEdad: number | null;
  readonly esFechaEx: boolean | null;
  readonly vistaEn: Date | null;
}

export interface AlertaVista {
  readonly id: string;
  readonly tipo: string;
  readonly texto: string;
  /** De dónde y cuándo es el dato; null si la alerta no tiene un dato único. */
  readonly procedencia: Procedencia | null;
  /** «25-nov-2026 18:45» si ya está marcada; null si falta. */
  readonly vista: string | null;
}

export interface DiaDeAlertas {
  readonly dia: string;
  readonly titulo: string;
  readonly alertas: readonly AlertaVista[];
}

export interface VistaAlertas {
  readonly dias: readonly DiaDeAlertas[];
  /** Cuántas de las mostradas faltan por marcar. */
  readonly sinVer: number;
  readonly total: number;
}

const esTipo = (t: string): t is TipoAlerta => (TIPOS_ALERTA as readonly string[]).includes(t);
const esSentido = (s: string | null): s is SentidoAlerta => s === "BAJO" || s === "SOBRE" || s === "RUEDA" || s === "CIERRE_FALTANTE";
const esBase = (b: string | null): b is BasePrecio => b === "INTRADIA" || b === "CIERRE";
const sinNulo = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

/** La alerta del motor reconstruida desde la evidencia guardada (para `textoDeAlerta`). Un tipo desconocido lanza. */
export function aAlertaDelMotor(f: FilaAlerta): Alerta {
  if (!esTipo(f.tipo)) throw new RangeError("tipo de alerta desconocido");
  const sentido = esSentido(f.sentido) ? f.sentido : null;
  const base = esBase(f.base) ? f.base : null;
  const dia = diaIso(f.dia);
  return {
    clave: claveDeAlerta(dia, f.tipo, null, null, sentido),
    dia,
    tipo: f.tipo,
    instrumentoId: null,
    reglaId: null,
    sentido,
    base,
    datos: {
      nivel: sinNulo(f.referencia),
      precio: sinNulo(f.precio),
      // En NIVEL_CERCA la columna guarda la distancia al nivel; en los demás, la variación.
      variacionPct: f.tipo === "NIVEL_CERCA" ? undefined : sinNulo(f.variacionPct),
      distanciaPct: f.tipo === "NIVEL_CERCA" ? sinNulo(f.variacionPct) : undefined,
      instante: sinNulo(f.instanteDato),
      conRetraso: sinNulo(f.conRetraso),
      esFechaEx: sinNulo(f.esFechaEx),
      fechaEx: sinNulo(f.fechaExDecreto),
      fechaPago: sinNulo(f.fechaPagoDecreto),
      minutosDeEdad: sinNulo(f.minutosDeEdad),
      umbralMin: f.umbral === null ? undefined : f.umbral.toNumber(),
    },
  };
}

/** La procedencia del dato de la alerta: un cierre del día o una barra de la rueda, con su fuente y su hora de traída. */
export function procedenciaDeAlerta(f: FilaAlerta): Procedencia | null {
  if (f.traidoEn === null || f.fuente === null || !esBase(f.base)) return null;
  const dia = diaIso(f.dia);
  const traidoEn = horaColombia(f.traidoEn);
  if (f.base === "CIERRE") return { dia, traidoEn, fuente: f.fuente, tipo: "CIERRE" };
  if (f.instanteDato === null) return null;
  return { dia, traidoEn, fuente: f.fuente, tipo: "RUEDA", horaDato: horaColombia(f.instanteDato).slice(11) };
}

const etiquetaDe = (f: FilaAlerta): string => f.nemotecnico ?? "";

function aVista(f: FilaAlerta): AlertaVista {
  return {
    id: f.id,
    tipo: f.tipo,
    texto: textoDeAlerta(aAlertaDelMotor(f), etiquetaDe(f)),
    procedencia: procedenciaDeAlerta(f),
    vista: f.vistaEn === null ? null : `${fecha(horaColombia(f.vistaEn).slice(0, 10))} ${horaColombia(f.vistaEn).slice(11)}`,
  };
}

/** Agrupa por día (el más reciente primero; dentro del día, el orden de entrada) y cuenta las sin marcar. */
export function construirVista(filas: readonly FilaAlerta[]): VistaAlertas {
  const porDia = new Map<string, AlertaVista[]>();
  for (const f of filas) {
    const dia = diaIso(f.dia);
    porDia.set(dia, [...(porDia.get(dia) ?? []), aVista(f)]);
  }
  const dias = [...porDia.entries()].sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0)).map(([dia, alertas]): DiaDeAlertas => ({ dia, titulo: fecha(dia), alertas }));
  return { dias, sinVer: filas.filter((f) => f.vistaEn === null).length, total: filas.length };
}
