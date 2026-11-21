/**
 * Guarda los cierres de Yahoo de las especies con posición (INV-SPEC-13).
 * - Versionado: si Yahoo revisa un cierre, el anterior queda con `reemplazadoEn` (historia) y se
 *   inserta el nuevo; un cierre igual no se toca.
 * - Candado: si hay certificación de A&V con fecha de corte igual, el cierre se compara con su
 *   precio de valoración: VERIFICADO si difiere ≤ 1 %, si no NO_VERIFICADO. Sin referencia oficial
 *   ese día, NO_VERIFICADO (nunca se presenta como verificado lo que no se comparó).
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
import { Prisma, type PrismaClient } from "@prisma/client";
import { aniosDelRango, leerCalendario, motivoOmision, retiraElVigente, type CalendarioBvc, type MotivoOmision } from "./negociacion";
import { obtenerCierres, type Buscar, type Cierre } from "./yahoo";

export const TOLERANCIA_VERIFICACION = new Prisma.Decimal("0.01");
export const FUENTE = "yahoo";
/** Intentos de guardar una barra cuando choca con otra corrida simultánea. */
export const MAX_INTENTOS_GUARDADO = 3;

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
  readonly retirados: number;
  readonly omitidas: Omitidas;
}
const CONTEO_CERO: Conteo = { nuevos: 0, revisados: 0, retirados: 0, omitidas: { HORARIO: 0, NO_HABIL: 0, SIN_NEGOCIACION: 0, SIN_CALENDARIO: 0 } };

function sumar(a: Conteo, b: Conteo): Conteo {
  const o = (m: MotivoOmision) => a.omitidas[m] + b.omitidas[m];
  return {
    nuevos: a.nuevos + b.nuevos, revisados: a.revisados + b.revisados, retirados: a.retirados + b.retirados,
    omitidas: { HORARIO: o("HORARIO"), NO_HABIL: o("NO_HABIL"), SIN_NEGOCIACION: o("SIN_NEGOCIACION"), SIN_CALENDARIO: o("SIN_CALENDARIO") },
  };
}

const conOmitida = (c: Conteo, motivo: MotivoOmision): Conteo => ({ ...c, omitidas: { ...c.omitidas, [motivo]: c.omitidas[motivo] + 1 } });

/** Calendario de la BVC de los años del rango, en una consulta. */
export async function leerCalendarioBvc(db: Pick<PrismaClient, "calendarioBvc">, desde: Date, hasta: Date): Promise<CalendarioBvc> {
  return leerCalendario(await db.calendarioBvc.findMany({ where: { dia: aniosDelRango(desde, hasta) }, select: { dia: true, esHabil: true } }));
}

/** Símbolo de Yahoo vigente en la fecha, o `<NEMO>.CL` si no hay equivalencia registrada. */
export async function simboloDe(db: PrismaClient, instrumentoId: string, nemotecnico: string, hoy: Date): Promise<string> {
  const mapa = await db.simboloPrecio.findFirst({
    where: { instrumentoId, proveedor: FUENTE, vigenteDesde: { lte: hoy }, OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: hoy } }] },
    select: { simbolo: true },
  });
  return mapa?.simbolo ?? `${nemotecnico}.CL`;
}

/** Otra corrida reemplazó el vigente entre la lectura y el reemplazo: hay que releer. */
class ConflictoConcurrente extends Error {
  constructor() {
    super("conflicto");
    this.name = "ConflictoConcurrente";
  }
}

const esConflicto = (e: unknown): boolean => e instanceof ConflictoConcurrente || (e as { code?: unknown } | null)?.code === "P2002";

async function estadoDe(db: Pick<Prisma.TransactionClient, "certificacionPosicion">, instrumentoId: string, c: Cierre) {
  const ref = await db.certificacionPosicion.findFirst({
    where: { instrumentoId, certificacion: { fechaCorte: c.fecha } },
    select: { precioValoracion: true, certificacion: { select: { fechaCorte: true } } },
  });
  if (!ref) return { estado: "NO_VERIFICADO" as const, fuenteReferencia: null, precioReferencia: null, desviacionPct: null };
  const precio = new Prisma.Decimal(c.precio);
  const desviacion = precio.sub(ref.precioValoracion).abs().div(ref.precioValoracion);
  return {
    estado: desviacion.lte(TOLERANCIA_VERIFICACION) ? ("VERIFICADO" as const) : ("NO_VERIFICADO" as const),
    fuenteReferencia: `certificacion:${ref.certificacion.fechaCorte.toISOString().slice(0, 10)}`,
    precioReferencia: ref.precioValoracion,
    desviacionPct: desviacion.mul(100).toDecimalPlaces(6),
  };
}

type Cambio = "nuevo" | "revisado" | null;

/** Un intento, en una transacción: leer el vigente, compararlo, reemplazarlo con guarda e insertar. Todo o nada. */
async function guardarCierreUnaVez(db: PrismaClient, instrumentoId: string, c: Cierre): Promise<Cambio> {
  return db.$transaction(async (tx) => {
    const vigente = await tx.precioCierre.findFirst({ where: { instrumentoId, fecha: c.fecha, fuente: FUENTE, reemplazadoEn: null }, select: { id: true, precio: true } });
    if (vigente?.precio.equals(c.precio)) return null;
    const verificacion = await estadoDe(tx, instrumentoId, c);
    if (vigente) {
      const { count } = await tx.precioCierre.updateMany({ where: { id: vigente.id, reemplazadoEn: null }, data: { reemplazadoEn: new Date() } });
      if (count !== 1) throw new ConflictoConcurrente();
    }
    await tx.precioCierre.create({ data: { instrumentoId, fecha: c.fecha, precio: new Prisma.Decimal(c.precio), fuente: FUENTE, ...verificacion } });
    return vigente ? "revisado" : "nuevo";
  });
}

/** Devuelve "nuevo", "revisado" o null (sin cambios). Ante una carrera con otra corrida, relee y reintenta. */
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

const conCambio = (c: Conteo, cambio: Cambio): Conteo => ({ ...c, nuevos: c.nuevos + (cambio === "nuevo" ? 1 : 0), revisados: c.revisados + (cambio === "revisado" ? 1 : 0) });

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

interface OpcionesActualizacion {
  readonly desde: Date;
  readonly hasta: Date;
  readonly buscar: Buscar;
  readonly instrumentoIds?: readonly string[];
  readonly ahora?: Date;
}

/** Una especie: pide a Yahoo y guarda. Un fallo de Yahoo o del símbolo no escribe nada y se informa. */
async function procesarEspecie(db: PrismaClient, e: { readonly id: string; readonly nemotecnico: string | null }, opciones: OpcionesActualizacion, ahora: Date, calendario: CalendarioBvc): Promise<ResultadoEspecie> {
  let r;
  try {
    r = await obtenerCierres(await simboloDe(db, e.id, e.nemotecnico!, opciones.hasta), opciones.desde, opciones.hasta, opciones.buscar);
  } catch (err) {
    return { conteo: CONTEO_CERO, fallo: { instrumentoId: e.id, codigo: "GUARDADO_ERROR", detalle: detalleDeError(err), barrasGuardadas: 0, barrasFallidas: 0 } };
  }
  if (!r.ok) return { conteo: CONTEO_CERO, fallo: { instrumentoId: e.id, codigo: r.codigo, barrasGuardadas: 0, barrasFallidas: 0 } };
  return guardarBarras(db, e.id, r.cierres, ahora, calendario);
}

export async function actualizarPrecios(db: PrismaClient, opciones: OpcionesActualizacion): Promise<ResultadoActualizacion> {
  const especies = await db.instrumento.findMany({
    where: { tipo: "ACCION", activo: true, nemotecnico: { not: null }, ...(opciones.instrumentoIds ? { id: { in: [...opciones.instrumentoIds] } } : { lotes: { some: {} } }) },
    select: { id: true, nemotecnico: true },
  });
  const ahora = opciones.ahora ?? new Date();
  const calendario = await leerCalendarioBvc(db, opciones.desde, opciones.hasta);
  let total = CONTEO_CERO;
  const fallidas: FalloEspecie[] = [];
  for (const e of especies) {
    const r = await procesarEspecie(db, e, opciones, ahora, calendario);
    total = sumar(total, r.conteo);
    if (r.fallo) fallidas.push(r.fallo);
  }
  const verificados = await db.precioCierre.count({ where: { estado: "VERIFICADO", reemplazadoEn: null, fecha: { gte: opciones.desde, lte: opciones.hasta } } });
  return {
    especies: especies.length, cierresNuevos: total.nuevos, cierresRevisados: total.revisados, cierresRetirados: total.retirados, verificados,
    omitidasPorHorario: total.omitidas.HORARIO, omitidasNoHabil: total.omitidas.NO_HABIL, omitidasSinNegociacion: total.omitidas.SIN_NEGOCIACION, omitidasSinCalendario: total.omitidas.SIN_CALENDARIO,
    fallidas,
  };
}
