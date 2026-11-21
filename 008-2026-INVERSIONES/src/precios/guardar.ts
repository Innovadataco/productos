/**
 * El camino ÚNICO de escritura de los cierres diarios (INV-SPEC-13). Lo usan `precios:actualizar` (desde Yahoo,
 * `actualizar.ts`) y `precios:importar` (desde el CSV de cierres que exporta el Mac, `importar.ts`): las dos
 * entregan, por especie, una función que trae sus cierres, y todo lo demás pasa por aquí. Candado:
 * tests/unit/precios/camino-unico.test.ts (nada más inserta en precio_cierre).
 * - Versionado: si Yahoo revisa un cierre, el anterior queda con `reemplazadoEn` (historia) y se
 *   inserta el nuevo.
 * - Candado: si hay certificación de A&V con fecha de corte igual, el cierre se compara con su
 *   precio de valoración: VERIFICADO si difiere ≤ 1 %, si no NO_VERIFICADO. Sin referencia oficial
 *   ese día, NO_VERIFICADO (nunca se presenta como verificado lo que no se comparó). Con una valoración
 *   ≤ 0 o una desviación que no cabe en `desviacionPct`, NO_VERIFICADO con la referencia y sin desviación.
 * - Re-verificación: la verificación (estado y referencia) se recalcula en cada corrida, también si el
 *   cierre es igual. Si con el mismo precio difiere de la guardada (llegó, cambió o ya no está la
 *   certificación de ese día), se versiona como una revisión y cuenta como re-verificado; en las dos
 *   direcciones (NO_VERIFICADO → VERIFICADO y al revés). Mismo precio y misma verificación: no se escribe.
 * - SPEC-13 «nunca un precio viejo como de hoy»: una barra que no es el cierre de su día (aún no
 *   definitiva, día no hábil, sin negociación o año sin calendario; ver `negociacion.ts`) no se guarda
 *   y se cuenta por su razón. Si la razón es día no hábil o sin negociación y ya había un cierre
 *   vigente de ese día (guardado por el código anterior), se retira: queda con `reemplazadoEn` y sin
 *   sucesor (historia, nunca se borra). Así una corrida con `--desde` corrige lo ya guardado.
 * - Una fuente caída o un símbolo sin datos no escribe nada para esa especie: se informa.
 * - Cada barra se guarda en una transacción (lectura del vigente, reemplazo con guarda e inserción).
 *   Ante una carrera con otra corrida (el vigente ya fue reemplazado, o P2002 por el índice parcial
 *   único) se deshace y se reintenta releyendo: lo que la otra corrida ya guardó igual queda «sin cambios».
 */
import { Prisma, type EstadoPrecio, type PrismaClient } from "@prisma/client";
import { aniosDelRango, leerCalendario, motivoOmision, retiraElVigente, type CalendarioBvc, type MotivoOmision } from "./negociacion";
import type { Cierre, ResultadoYahoo } from "./yahoo";

export const TOLERANCIA_VERIFICACION = new Prisma.Decimal("0.01");
/** Lo más que cabe en `precio_cierre.desviacionPct` (Decimal(9,6)). */
export const DESVIACION_PCT_MAXIMA = new Prisma.Decimal("999.999999");
/** Fuente de los cierres: Yahoo, se traigan directo o en el CSV exportado desde el Mac (es el mismo dato). */
export const FUENTE = "yahoo";
/** Intentos de guardar una barra cuando choca con otra corrida simultánea. */
export const MAX_INTENTOS_GUARDADO = 3;
/**
 * Plazo de la transacción de cada barra y espera de una conexión libre. El de Prisma por defecto (5 s y 2 s) daría
 * P2028 con una base lenta o con `connection_limit` bajo, y P2028 no se reintenta (no es una carrera).
 */
const OPCIONES_TRANSACCION = { timeout: 15_000, maxWait: 10_000 } as const;

export interface FalloEspecie {
  readonly instrumentoId: string;
  readonly codigo: string;
  /** Solo nombre y código del error (p. ej. «PrismaClientKnownRequestError P2002»); nunca el mensaje. */
  readonly detalle?: string;
  readonly barrasGuardadas: number;
  readonly barrasFallidas: number;
}

/** Causa de un error sin exponer su mensaje (puede traer valores de la consulta). */
export function detalleDeError(e: unknown): string {
  if (!(e instanceof Error)) return "error";
  const codigo = (e as { code?: unknown }).code;
  return typeof codigo === "string" ? `${e.name} ${codigo}` : e.name;
}

export interface ResultadoActualizacion {
  readonly especies: number;
  readonly cierresNuevos: number;
  readonly cierresRevisados: number;
  /** Mismo cierre con otra verificación (llegó, cambió o ya no está la certificación del día): nueva versión. */
  readonly cierresReverificados: number;
  /** Vigentes retirados (reemplazadoEn, sin sucesor) porque su día ahora se omite por no hábil o sin negociación. */
  readonly cierresRetirados: number;
  readonly verificados: number;
  /** Barras aún no definitivas: hoy antes de la hora, hoy no hábil o fecha futura. */
  readonly omitidasPorHorario: number;
  /** Barras de fin de semana o festivo de calendario_bvc. */
  readonly omitidasNoHabil: number;
  /** Barras con volumen 0: ese día no hubo negociación. */
  readonly omitidasSinNegociacion: number;
  /** Barras de un día entre semana de un año que calendario_bvc no cubre. */
  readonly omitidasSinCalendario: number;
  readonly fallidas: readonly FalloEspecie[];
}

type Omitidas = Readonly<Record<MotivoOmision, number>>;
interface Conteo {
  readonly nuevos: number;
  readonly revisados: number;
  readonly reverificados: number;
  readonly retirados: number;
  readonly omitidas: Omitidas;
}
const CONTEO_CERO: Conteo = { nuevos: 0, revisados: 0, reverificados: 0, retirados: 0, omitidas: { HORARIO: 0, NO_HABIL: 0, SIN_NEGOCIACION: 0, SIN_CALENDARIO: 0 } };

function sumar(a: Conteo, b: Conteo): Conteo {
  const o = (m: MotivoOmision) => a.omitidas[m] + b.omitidas[m];
  return {
    nuevos: a.nuevos + b.nuevos, revisados: a.revisados + b.revisados, reverificados: a.reverificados + b.reverificados, retirados: a.retirados + b.retirados,
    omitidas: { HORARIO: o("HORARIO"), NO_HABIL: o("NO_HABIL"), SIN_NEGOCIACION: o("SIN_NEGOCIACION"), SIN_CALENDARIO: o("SIN_CALENDARIO") },
  };
}

const conOmitida = (c: Conteo, motivo: MotivoOmision): Conteo => ({ ...c, omitidas: { ...c.omitidas, [motivo]: c.omitidas[motivo] + 1 } });

/** Calendario de la BVC de los años del rango, en una consulta. */
export async function leerCalendarioBvc(db: Pick<PrismaClient, "calendarioBvc">, desde: Date, hasta: Date): Promise<CalendarioBvc> {
  return leerCalendario(await db.calendarioBvc.findMany({ where: { dia: aniosDelRango(desde, hasta) }, select: { dia: true, esHabil: true } }));
}

/** Otra corrida reemplazó el vigente entre la lectura y el reemplazo: hay que releer. */
class ConflictoConcurrente extends Error {
  constructor() {
    super("conflicto");
    this.name = "ConflictoConcurrente";
  }
}

const esConflicto = (e: unknown): boolean => e instanceof ConflictoConcurrente || (e as { code?: unknown } | null)?.code === "P2002";

/** El resultado del candado que se guarda con el cierre: su estado y la referencia que lo sustenta. */
export interface Verificacion {
  readonly estado: EstadoPrecio;
  readonly fuenteReferencia: string | null;
  readonly precioReferencia: Prisma.Decimal | null;
  readonly desviacionPct: Prisma.Decimal | null;
}

const SIN_REFERENCIA: Verificacion = { estado: "NO_VERIFICADO", fuenteReferencia: null, precioReferencia: null, desviacionPct: null };

async function estadoDe(db: Pick<Prisma.TransactionClient, "certificacionPosicion">, instrumentoId: string, c: Cierre): Promise<Verificacion> {
  const ref = await db.certificacionPosicion.findFirst({
    where: { instrumentoId, certificacion: { fechaCorte: c.fecha } },
    select: { precioValoracion: true, certificacion: { select: { fechaCorte: true } } },
  });
  if (!ref) return SIN_REFERENCIA;
  const referencia = { fuenteReferencia: `certificacion:${ref.certificacion.fechaCorte.toISOString().slice(0, 10)}`, precioReferencia: ref.precioValoracion };
  // Valoración absurda (≤ 0) o desviación que no cabe en la columna: se comparó y no cuadra. Nunca VERIFICADO,
  // y sin desviación (no se guarda Infinity ni un desborde que deje la especie con GUARDADO_ERROR en cada corrida).
  const noCuadra: Verificacion = { estado: "NO_VERIFICADO", ...referencia, desviacionPct: null };
  if (ref.precioValoracion.lte(0)) return noCuadra;
  const desviacion = new Prisma.Decimal(c.precio).sub(ref.precioValoracion).abs().div(ref.precioValoracion);
  const desviacionPct = desviacion.mul(100).toDecimalPlaces(6);
  if (desviacionPct.gt(DESVIACION_PCT_MAXIMA)) return noCuadra;
  return { estado: desviacion.lte(TOLERANCIA_VERIFICACION) ? "VERIFICADO" : "NO_VERIFICADO", ...referencia, desviacionPct };
}

/** Por valor (0 = 0.000000); null solo es igual a null. */
const mismoDecimal = (a: Prisma.Decimal | null, b: Prisma.Decimal | null): boolean => (a === null || b === null ? a === b : a.equals(b));

/** Puro: ¿las dos verificaciones dicen lo mismo, con la misma referencia? Compara los 4 campos. */
export function mismaVerificacion(a: Verificacion, b: Verificacion): boolean {
  return a.estado === b.estado && a.fuenteReferencia === b.fuenteReferencia && mismoDecimal(a.precioReferencia, b.precioReferencia) && mismoDecimal(a.desviacionPct, b.desviacionPct);
}

type Cambio = "nuevo" | "revisado" | "reverificado" | null;

/** Lo que se lee del vigente: el precio y la verificación completa, para compararlos. */
const SELECCION_VIGENTE = {
  id: true, precio: true, estado: true, fuenteReferencia: true, precioReferencia: true, desviacionPct: true,
} as const satisfies Prisma.PrecioCierreSelect;

/** Puro. Sin vigente: nuevo; otro precio: revisado; mismo precio y otra verificación: re-verificado; si no, nada. */
function clasificar(vigente: (Verificacion & { readonly precio: Prisma.Decimal }) | null, precio: string, calculada: Verificacion): Cambio {
  if (!vigente) return "nuevo";
  if (!vigente.precio.equals(precio)) return "revisado";
  return mismaVerificacion(vigente, calculada) ? null : "reverificado";
}

/** Un intento, en una transacción: leer el vigente, compararlo, reemplazarlo con guarda e insertar. Todo o nada. */
async function guardarCierreUnaVez(db: PrismaClient, instrumentoId: string, c: Cierre): Promise<Cambio> {
  return db.$transaction(async (tx) => {
    const vigente = await tx.precioCierre.findFirst({ where: { instrumentoId, fecha: c.fecha, fuente: FUENTE, reemplazadoEn: null }, select: SELECCION_VIGENTE });
    const verificacion = await estadoDe(tx, instrumentoId, c);
    const cambio = clasificar(vigente, c.precio, verificacion);
    if (cambio === null) return null;
    if (vigente) {
      const { count } = await tx.precioCierre.updateMany({ where: { id: vigente.id, reemplazadoEn: null }, data: { reemplazadoEn: new Date() } });
      if (count !== 1) throw new ConflictoConcurrente();
    }
    await tx.precioCierre.create({ data: { instrumentoId, fecha: c.fecha, precio: new Prisma.Decimal(c.precio), fuente: FUENTE, ...verificacion } });
    return cambio;
  }, OPCIONES_TRANSACCION);
}

/** Devuelve "nuevo", "revisado", "reverificado" o null (sin cambios). Ante una carrera con otra corrida, relee y reintenta. */
async function guardarCierre(db: PrismaClient, instrumentoId: string, c: Cierre): Promise<Cambio> {
  for (let intento = 1; ; intento += 1) {
    try {
      return await guardarCierreUnaVez(db, instrumentoId, c);
    } catch (err) {
      if (!esConflicto(err) || intento >= MAX_INTENTOS_GUARDADO) throw err;
    }
  }
}

/**
 * Retira los cierres vigentes de la especie en esas fechas: `reemplazadoEn` sin sucesor; las filas
 * quedan como historia. Una sola sentencia con guarda (`reemplazadoEn: null`): ante otra corrida,
 * una retira y la otra ve 0. Devuelve cuántos retiró.
 */
export async function retirarVigentes(db: Pick<PrismaClient, "precioCierre">, instrumentoId: string, fechas: readonly Date[]): Promise<number> {
  if (fechas.length === 0) return 0;
  const { count } = await db.precioCierre.updateMany({ where: { instrumentoId, fecha: { in: [...fechas] }, fuente: FUENTE, reemplazadoEn: null }, data: { reemplazadoEn: new Date() } });
  return count;
}

const conCambio = (c: Conteo, cambio: Cambio): Conteo => ({
  ...c,
  nuevos: c.nuevos + (cambio === "nuevo" ? 1 : 0),
  revisados: c.revisados + (cambio === "revisado" ? 1 : 0),
  reverificados: c.reverificados + (cambio === "reverificado" ? 1 : 0),
});

interface ResultadoEspecie {
  readonly conteo: Conteo;
  readonly fallo: FalloEspecie | null;
}

/**
 * Guarda las barras que son cierre de su día, cuenta las omitidas y, al final, retira en una sola
 * sentencia los vigentes de los días que sobran. Una barra que falla no aborta las demás.
 */
async function guardarBarras(db: PrismaClient, instrumentoId: string, cierres: readonly Cierre[], ahora: Date, calendario: CalendarioBvc): Promise<ResultadoEspecie> {
  let conteo = CONTEO_CERO;
  let barrasGuardadas = 0;
  let barrasFallidas = 0;
  let detalle: string | undefined;
  const aRetirar: Date[] = [];
  for (const c of cierres) {
    const motivo = motivoOmision(c, ahora, calendario);
    if (motivo) {
      conteo = conOmitida(conteo, motivo);
      if (retiraElVigente(motivo)) aRetirar.push(c.fecha);
      continue;
    }
    try {
      conteo = conCambio(conteo, await guardarCierre(db, instrumentoId, c));
      barrasGuardadas += 1;
    } catch (err) {
      barrasFallidas += 1;
      detalle ??= detalleDeError(err);
    }
  }
  try {
    conteo = { ...conteo, retirados: conteo.retirados + (await retirarVigentes(db, instrumentoId, aRetirar)) };
  } catch (err) {
    barrasFallidas += aRetirar.length;
    detalle ??= detalleDeError(err);
  }
  const fallo = barrasFallidas > 0 ? { instrumentoId, codigo: "GUARDADO_ERROR", ...(detalle ? { detalle } : {}), barrasGuardadas, barrasFallidas } : null;
  return { conteo, fallo };
}

/** Una especie y cómo traer sus cierres (de Yahoo o del CSV). `traer` puede lanzar (la base al buscar el símbolo, la red). */
export interface EspecieAGuardar {
  readonly instrumentoId: string;
  readonly traer: () => Promise<ResultadoYahoo>;
}

export interface RangoGuardado {
  /** Rango de los cierres: define los años de calendario_bvc que se leen y el conteo de verificados. */
  readonly desde: Date;
  readonly hasta: Date;
  /** El instante con que se decide si una barra ya es definitiva (`motivoOmision`). */
  readonly ahora: Date;
}

/** Una especie: trae y guarda. Si traer falla o responde con un código, no escribe nada y se informa. */
async function procesarEspecie(db: PrismaClient, e: EspecieAGuardar, ahora: Date, calendario: CalendarioBvc): Promise<ResultadoEspecie> {
  let r: ResultadoYahoo;
  try {
    r = await e.traer();
  } catch (err) {
    return { conteo: CONTEO_CERO, fallo: { instrumentoId: e.instrumentoId, codigo: "GUARDADO_ERROR", detalle: detalleDeError(err), barrasGuardadas: 0, barrasFallidas: 0 } };
  }
  if (!r.ok) return { conteo: CONTEO_CERO, fallo: { instrumentoId: e.instrumentoId, codigo: r.codigo, barrasGuardadas: 0, barrasFallidas: 0 } };
  return guardarBarras(db, e.instrumentoId, r.cierres, ahora, calendario);
}

/**
 * Lee el calendario de la BVC del rango una vez, trae y guarda las especies en serie (una que falla no detiene
 * las demás) y cuenta los cierres VERIFICADOS vigentes del rango (de todas las especies).
 */
export async function guardarCierresDeEspecies(db: PrismaClient, especies: readonly EspecieAGuardar[], rango: RangoGuardado): Promise<ResultadoActualizacion> {
  const calendario = await leerCalendarioBvc(db, rango.desde, rango.hasta);
  let total = CONTEO_CERO;
  const fallidas: FalloEspecie[] = [];
  for (const e of especies) {
    const r = await procesarEspecie(db, e, rango.ahora, calendario);
    total = sumar(total, r.conteo);
    if (r.fallo) fallidas.push(r.fallo);
  }
  const verificados = await db.precioCierre.count({ where: { estado: "VERIFICADO", reemplazadoEn: null, fecha: { gte: rango.desde, lte: rango.hasta } } });
  return {
    especies: especies.length, cierresNuevos: total.nuevos, cierresRevisados: total.revisados, cierresReverificados: total.reverificados, cierresRetirados: total.retirados, verificados,
    omitidasPorHorario: total.omitidas.HORARIO, omitidasNoHabil: total.omitidas.NO_HABIL, omitidasSinNegociacion: total.omitidas.SIN_NEGOCIACION, omitidasSinCalendario: total.omitidas.SIN_CALENDARIO,
    fallidas,
  };
}
