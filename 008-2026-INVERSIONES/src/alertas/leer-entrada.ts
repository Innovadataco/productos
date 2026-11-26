/**
 * Lee de la base lo que `evaluarAlertas` necesita (src/alertas/evaluar): las especies que se tienen o tienen regla en el plan
 * vigente, su tenencia por operación, los cierres de hoy y del día hábil anterior, la última barra intradía, los decretos,
 * el calendario y los umbrales vigentes. Solo lectura y por `select` explícito: son exactamente las columnas que le da
 * docker/migrador/privilegios.sql al rol inv_alertas (lista única tests/unit/produccion/permisos-alertas.ts); una columna
 * más daría 42501. Sin `server-only` ni lectores de la app, para que lo corra el servicio de las alertas (fuera de Next).
 * Falla cerrada: sin cierre del día hábil anterior no hay cierre anterior (no hay movimiento ni caída con un dato viejo).
 * También devuelve la procedencia de cada dato (hora de traída y fuente) para guardarla como evidencia de la alerta.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { sumarDias } from "../plan/fechas";
import { diaIso, esDiaHabil, fechaEnBogota } from "../precios/horario";
import { especiesIntradia } from "../precios/intradia/especies";
import type { EntradaEvaluacion, EspecieEvaluada, ReglaEvaluada } from "./evaluar";
import type { DecretoParaAlerta } from "./evaluar/fecha-ex";
import type { MovimientoTenencia } from "../plan/tenencia";
import { UMBRALES_OMISION, type Umbrales } from "./umbrales";

export type LectorAlertas = Pick<
  PrismaClient,
  "$queryRaw" | "instrumento" | "planVersion" | "reglaPlan" | "precioCierre" | "dividendoDecretado" | "calendarioBvc" | "umbralVersion"
>;

/** Un cierre vigente de una especie en un día, con de dónde y cuándo se trajo. */
export interface CierreLeido {
  readonly precio: Prisma.Decimal;
  readonly traidoEn: Date;
  readonly fuente: string;
}

/** De dónde salió el dato de una especie: el cierre de hoy y la última barra (hora de la barra, de traída y fuente). */
export interface Procedencia {
  readonly cierre?: { readonly traidoEn: Date; readonly fuente: string };
  readonly intradia?: { readonly instante: Date; readonly traidoEn: Date; readonly fuente: string };
}

export interface EntradaLeida {
  readonly entrada: EntradaEvaluacion;
  readonly procedencia: ReadonlyMap<string, Procedencia>;
  /** La versión de umbrales vigente; null si no hay ninguna (rigen las omisiones). */
  readonly umbralVersionId: string | null;
}

const DESFASE_COLOMBIA_MS = 5 * 60 * 60 * 1000;
/** Cuántos días hacia atrás se busca el día hábil anterior (festivos y fines de semana seguidos). */
const TOPE_RETROCESO_DIAS = 14;
/** Cuántos días antes y después de hoy se lee el calendario: el día hábil anterior (14) y la ventana de la fecha ex (hasta 10 días hábiles). */
const CALENDARIO_ATRAS_DIAS = 20;
const CALENDARIO_ADELANTE_DIAS = 40;

type FilaUmbral = Prisma.UmbralVersionGetPayload<{ select: typeof SELECCION_UMBRAL }>;
const SELECCION_UMBRAL = {
  id: true, alertaCercaPct: true, alertaCercaActiva: true, alertaNivelCruzadoActiva: true, alertaMovimientoPct: true, alertaMovimientoActiva: true,
  alertaCaidaPct: true, alertaCaidaActiva: true, alertaDatoViejoMin: true, alertaDatoViejoActiva: true, alertaExDiasHabiles: true, alertaExActiva: true,
} as const;

export function umbralesDeFila(f: FilaUmbral): Umbrales {
  return {
    alertaCercaPct: f.alertaCercaPct.toNumber(), alertaCercaActiva: f.alertaCercaActiva, alertaNivelCruzadoActiva: f.alertaNivelCruzadoActiva,
    alertaMovimientoPct: f.alertaMovimientoPct.toNumber(), alertaMovimientoActiva: f.alertaMovimientoActiva,
    alertaCaidaPct: f.alertaCaidaPct.toNumber(), alertaCaidaActiva: f.alertaCaidaActiva,
    alertaDatoViejoMin: f.alertaDatoViejoMin, alertaDatoViejoActiva: f.alertaDatoViejoActiva,
    alertaExDiasHabiles: f.alertaExDiasHabiles, alertaExActiva: f.alertaExActiva,
  };
}

/** El día hábil anterior a `hoy` según el calendario, o null si no hay uno en los últimos 14 días. */
export function diaHabilAnterior(hoy: Date, noHabiles: ReadonlySet<string>): Date | null {
  for (let i = 1; i <= TOPE_RETROCESO_DIAS; i += 1) {
    const d = sumarDias(hoy, -i);
    if (esDiaHabil(d, noHabiles)) return d;
  }
  return null;
}

async function leerUmbrales(db: LectorAlertas): Promise<{ umbrales: Umbrales; versionId: string | null }> {
  const fila = await db.umbralVersion.findFirst({ orderBy: { version: "desc" }, select: SELECCION_UMBRAL });
  return fila === null ? { umbrales: { ...UMBRALES_OMISION }, versionId: null } : { umbrales: umbralesDeFila(fila), versionId: fila.id };
}

async function leerNoHabiles(db: LectorAlertas, hoy: Date): Promise<Set<string>> {
  const filas = await db.calendarioBvc.findMany({
    where: { esHabil: false, dia: { gte: sumarDias(hoy, -CALENDARIO_ATRAS_DIAS), lte: sumarDias(hoy, CALENDARIO_ADELANTE_DIAS) } },
    select: { dia: true },
  });
  return new Set(filas.map((f) => diaIso(f.dia)));
}

/**
 * La tenencia por operación, sumada por día y especie EN LA BASE (órdenes aprobadas: la compra suma y la venta resta; y lotes de
 * escisión), hasta hoy: una fila por (especie, día) en vez de todo el historial. `tenenciaEn` suma por fecha, así que es exacta.
 */
async function leerMovimientos(db: LectorAlertas, ids: readonly string[], hoy: Date): Promise<Map<string, MovimientoTenencia[]>> {
  const salida = new Map<string, MovimientoTenencia[]>(ids.map((id) => [id, []]));
  if (ids.length === 0) return salida;
  const filas = await db.$queryRaw<Array<{ instrumentoId: string; fecha: Date; cantidad: bigint }>>(Prisma.sql`
    SELECT m."instrumentoId", m."fecha", SUM(m."cantidad")::bigint AS "cantidad" FROM (
      SELECT o."instrumentoId", o."fechaOperacion" AS "fecha",
             CASE WHEN o."lado" = 'COMPRA'::"LadoOrden" THEN o."cantidadCompletada" ELSE -o."cantidadCompletada" END AS "cantidad"
      FROM "orden" o
      WHERE o."instrumentoId" = ANY(${[...ids]}::text[]) AND o."estado" = 'APROBADO'::"EstadoOrden" AND o."cantidadCompletada" > 0 AND o."fechaOperacion" <= ${hoy}
      UNION ALL
      SELECT l."instrumentoId", l."fechaCompra" AS "fecha", l."cantidad"
      FROM "lote" l
      WHERE l."instrumentoId" = ANY(${[...ids]}::text[]) AND l."origen" = 'ESCISION'::"OrigenLote" AND l."fechaCompra" <= ${hoy}
    ) m
    GROUP BY m."instrumentoId", m."fecha"
    ORDER BY m."instrumentoId", m."fecha"`);
  for (const f of filas) salida.get(f.instrumentoId)?.push({ fecha: f.fecha, cantidad: f.cantidad });
  return salida;
}

async function leerReglas(db: LectorAlertas, hoy: Date): Promise<Map<string, ReglaEvaluada[]>> {
  const version = await db.planVersion.findFirst({ where: { vigenteDesde: { lte: hoy } }, orderBy: { version: "desc" }, select: { id: true } });
  const porEspecie = new Map<string, ReglaEvaluada[]>();
  if (version === null) return porEspecie;
  const filas = await db.reglaPlan.findMany({ where: { planVersionId: version.id, instrumentoId: { not: null } }, select: { id: true, instrumentoId: true, condicion: true, nivel: true }, orderBy: { id: "asc" } });
  for (const f of filas) {
    if (f.instrumentoId === null) continue;
    porEspecie.set(f.instrumentoId, [...(porEspecie.get(f.instrumentoId) ?? []), { id: f.id, condicion: f.condicion, nivel: f.nivel }]);
  }
  return porEspecie;
}

async function leerDecretos(db: LectorAlertas, ids: readonly string[], hoy: Date): Promise<DecretoParaAlerta[]> {
  if (ids.length === 0) return [];
  // Se leen también los retirados y los anulados: el motor los descarta por `vigente` y `anulada` (evaluar/fecha-ex.ts), así el
  // criterio de «los decretos que cuentan» (vigentes.ts, el único filtro) no se repite aquí ni importa un módulo de servidor.
  const filas = await db.dividendoDecretado.findMany({
    where: { instrumentoId: { in: [...ids] }, fechaEx: { gte: hoy } },
    select: { id: true, instrumentoId: true, fechaEx: true, fechaPago: true, anulada: true, reemplazadoEn: true },
    orderBy: { id: "asc" },
  });
  return filas.map((d) => ({ id: d.id, instrumentoId: d.instrumentoId, fechaEx: d.fechaEx, fechaPago: d.fechaPago, vigente: d.reemplazadoEn === null, anulada: d.anulada }));
}

/** Los cierres vigentes de hoy y del día hábil anterior, el más reciente traído de cada (especie, día). */
async function leerCierres(db: LectorAlertas, ids: readonly string[], hoy: Date, anterior: Date | null): Promise<Map<string, CierreLeido>> {
  const dias = anterior === null ? [hoy] : [anterior, hoy];
  const filas = await db.precioCierre.findMany({
    where: { instrumentoId: { in: [...ids] }, fecha: { in: dias }, reemplazadoEn: null },
    select: { instrumentoId: true, fecha: true, precio: true, fuente: true, traidoEn: true },
    orderBy: { traidoEn: "desc" },
  });
  const m = new Map<string, CierreLeido>();
  for (const f of filas) {
    const clave = `${f.instrumentoId}|${diaIso(f.fecha)}`;
    if (!m.has(clave)) m.set(clave, { precio: f.precio, traidoEn: f.traidoEn, fuente: f.fuente });
  }
  return m;
}

interface BarraLeida {
  readonly instrumentoId: string;
  readonly instante: Date;
  readonly precio: Prisma.Decimal;
  readonly fuente: string;
  readonly conRetraso: boolean;
  readonly traidoEn: Date;
}

/**
 * La última barra de HOY de cada especie, en UNA consulta (DISTINCT ON). La de otro día no cuenta (`evaluarAlertas` solo usa la de
 * hoy y la edad se cuenta desde la apertura): sin barra de hoy la especie queda sin barra.
 */
async function leerBarras(db: LectorAlertas, ids: readonly string[], hoy: Date): Promise<Map<string, BarraLeida>> {
  if (ids.length === 0) return new Map();
  const desde = new Date(hoy.getTime() + DESFASE_COLOMBIA_MS);
  const filas = await db.$queryRaw<BarraLeida[]>(Prisma.sql`
    SELECT DISTINCT ON (p."instrumentoId") p."instrumentoId", p."instante", p."precio", p."fuente", p."conRetraso", p."traidoEn"
    FROM "precio_intradia" p
    WHERE p."instrumentoId" = ANY(${[...ids]}::text[]) AND p."instante" >= ${desde}
    ORDER BY p."instrumentoId", p."instante" DESC`);
  return new Map(filas.map((f) => [f.instrumentoId, f]));
}

export async function leerEntrada(db: LectorAlertas, ahora: Date, intradiaActivo: boolean): Promise<EntradaLeida> {
  const hoy = fechaEnBogota(ahora);
  const { umbrales, versionId } = await leerUmbrales(db);
  const noHabiles = await leerNoHabiles(db, hoy);
  const especies = await especiesIntradia(db, hoy);
  const ids = especies.map((e) => e.id);
  const anterior = diaHabilAnterior(hoy, noHabiles);
  const [movimientos, reglas, decretos, cierres] = await Promise.all([leerMovimientos(db, ids, hoy), leerReglas(db, hoy), leerDecretos(db, ids, hoy), leerCierres(db, ids, hoy, anterior)]);
  const barras = intradiaActivo ? await leerBarras(db, ids, hoy) : new Map<string, BarraLeida>();
  const procedencia = new Map<string, Procedencia>();
  const evaluadas: EspecieEvaluada[] = [];
  for (const { id } of especies) {
    const barra = barras.get(id) ?? null;
    const cierreHoy = cierres.get(`${id}|${diaIso(hoy)}`) ?? null;
    const cierreAnterior = anterior === null ? null : (cierres.get(`${id}|${diaIso(anterior)}`) ?? null);
    procedencia.set(id, {
      ...(cierreHoy === null ? {} : { cierre: { traidoEn: cierreHoy.traidoEn, fuente: cierreHoy.fuente } }),
      ...(barra === null ? {} : { intradia: { instante: barra.instante, traidoEn: barra.traidoEn, fuente: barra.fuente } }),
    });
    evaluadas.push({
      instrumentoId: id, reglas: reglas.get(id) ?? [], movimientos: movimientos.get(id) ?? [],
      intradia: barra === null ? null : { instante: barra.instante, precio: barra.precio, conRetraso: barra.conRetraso },
      cierreHoy: cierreHoy?.precio ?? null, cierreAnterior: cierreAnterior?.precio ?? null,
    });
  }
  return { entrada: { ahora, umbrales, intradiaActivo, noHabiles, especies: evaluadas, decretos }, procedencia, umbralVersionId: versionId };
}
