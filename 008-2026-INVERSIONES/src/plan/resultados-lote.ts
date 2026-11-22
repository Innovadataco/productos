/**
 * Resultado a 30 y 90 días de varias decisiones a la vez (fase B, corte 3), sin una consulta por decisión: las
 * decisiones con sus enlaces vigentes y, de todas sus especies juntas, los cierres VIGENTES de Yahoo (la fuente de
 * los diarios), los dividendos, los movimientos de la tenencia (órdenes aprobadas y lotes de escisión), las
 * escisiones, la cobertura de las cargas de Trii y las fechas de los decretos que cuentan alrededor de los pagos
 * (src/datos-oficiales/decretos/vigentes.ts: su filtro y el rango de la ventana del cruce). Después, el cálculo puro
 * de `resultado.ts` por decisión.
 * Solo lee, con `select` explícito (nunca el crudo). Quien quiera una sola instantánea lo llama dentro de
 * `enSoloLectura` (las pantallas lo hacen).
 */
import type { LadoOrden } from "@prisma/client";
import { leerFechasDeDecretos } from "../datos-oficiales/decretos/vigentes";
import { FUENTE as FUENTE_CIERRES } from "../precios/actualizar";
import { fechaEnBogota } from "../precios/horario";
import type { Db } from "./acceso";
import type { ContextoEspecie, DecretoDeLaEspecie, DividendoPagado } from "./dividendos";
import { sumarDias } from "./fechas";
import { HORIZONTES, MAX_RETROCESO_DIAS, calcularResultados, type Cierre, type OrdenMedida, type ResultadoHorizonte } from "./resultado";
import type { MovimientoTenencia } from "./tenencia";

export interface ResultadoDecision {
  readonly decisionId: string;
  readonly d30: ResultadoHorizonte;
  readonly d90: ResultadoHorizonte;
}

interface DecisionLeida {
  readonly id: string;
  readonly accion: "COMPRAR" | "VENDER" | "NO_ACTUAR";
  readonly fechaDecision: Date;
  readonly cantidad: bigint | null;
  readonly instrumentoId: string;
  readonly ordenes: readonly OrdenMedida[];
}

const HORIZONTE_MAX = Math.max(...HORIZONTES);
const SIGNO_LADO: Readonly<Record<LadoOrden, bigint>> = { COMPRA: 1n, VENTA: -1n };

function agrupar<T extends { readonly instrumentoId: string }, R>(filas: readonly T[], aValor: (f: T) => R): Map<string, R[]> {
  const m = new Map<string, R[]>();
  for (const f of filas) m.set(f.instrumentoId, [...(m.get(f.instrumentoId) ?? []), aValor(f)]);
  return m;
}

async function leerDecisiones(db: Db, ids: readonly string[]): Promise<DecisionLeida[]> {
  const filas = await db.decision.findMany({
    where: { id: { in: [...ids] } },
    select: {
      id: true, accion: true, fechaDecision: true, cantidad: true, instrumentoId: true,
      enlaces: { where: { reemplazadoPor: { is: null } }, select: { orden: { select: { id: true, fechaOperacion: true, cantidadCompletada: true, totalEstimado: true } } } },
    },
  });
  return filas.map((f) => ({ id: f.id, accion: f.accion, fechaDecision: f.fechaDecision, cantidad: f.cantidad, instrumentoId: f.instrumentoId, ordenes: f.enlaces.map((e) => e.orden) }));
}

export interface Rango {
  readonly desde: Date;
  readonly hasta: Date;
}

/** Hasta qué fecha leer los movimientos de cada especie (todos desde el principio: la tenencia se acumula). */
type Hastas = ReadonlyMap<string, Date> | Date;
const hastaDe = (hastas: Hastas, id: string): Date | undefined => (hastas instanceof Date ? hastas : hastas.get(id));

/** Movimientos de la tenencia por especie hasta su fecha: órdenes aprobadas por su operación y lotes de escisión por su fecha. */
export async function movimientosDeEspecies(db: Db, especies: readonly string[], hastas: Hastas): Promise<Map<string, MovimientoTenencia[]>> {
  const ids = especies.filter((id) => hastaDe(hastas, id) !== undefined);
  if (ids.length === 0) return new Map();
  const [ordenes, lotes] = await Promise.all([
    db.orden.findMany({
      where: { estado: "APROBADO", cantidadCompletada: { gt: 0n }, OR: ids.map((id) => ({ instrumentoId: id, fechaOperacion: { lte: hastaDe(hastas, id) } })) },
      select: { instrumentoId: true, lado: true, cantidadCompletada: true, fechaOperacion: true },
    }),
    db.lote.findMany({ where: { origen: "ESCISION", OR: ids.map((id) => ({ instrumentoId: id, fechaCompra: { lte: hastaDe(hastas, id) } })) }, select: { instrumentoId: true, cantidad: true, fechaCompra: true } }),
  ]);
  const filas = [
    ...ordenes.map((o) => ({ instrumentoId: o.instrumentoId, fecha: o.fechaOperacion, cantidad: SIGNO_LADO[o.lado] * o.cantidadCompletada })),
    ...lotes.map((l) => ({ instrumentoId: l.instrumentoId, fecha: l.fechaCompra, cantidad: l.cantidad })),
  ];
  return agrupar(filas, (f): MovimientoTenencia => ({ fecha: f.fecha, cantidad: f.cantidad }));
}

/** Hasta qué día llegan las cargas de Trii: el menor entre la última de órdenes y la última de dividendos (en Colombia). */
async function cubiertoHasta(db: Db): Promise<Date | null> {
  const cargas = await db.cargaArchivo.groupBy({
    by: ["tipoFuente"],
    where: { estado: "CARGADO", revertidaEn: null, tipoFuente: { in: ["TRII_ORDENES", "TRII_DIVIDENDOS"] } },
    _max: { cargadoEn: true },
  });
  const fechas = (["TRII_ORDENES", "TRII_DIVIDENDOS"] as const).map((t) => cargas.find((c) => c.tipoFuente === t)?._max.cargadoEn ?? null);
  if (fechas.some((f) => f === null)) return null;
  return fechaEnBogota(new Date(Math.min(...fechas.map((f) => f!.getTime()))));
}

interface BaseDecision {
  readonly instrumentoId: string;
  readonly fechaDecision: Date;
  readonly ordenes: readonly { readonly fechaOperacion: Date }[];
}

/** Por especie, los días que usan SUS decisiones: de la base más vieja − 7 días a la más reciente + 90. */
export function rangosPorEspecie(decisiones: readonly BaseDecision[]): Map<string, Rango> {
  const bases = agrupar(decisiones, (d) => [d.fechaDecision, ...d.ordenes.map((o) => o.fechaOperacion)].map((f) => f.getTime()));
  return new Map(
    [...bases].map(([id, listas]) => {
      const tiempos = listas.flat();
      return [id, { desde: sumarDias(new Date(Math.min(...tiempos)), -MAX_RETROCESO_DIAS), hasta: sumarDias(new Date(Math.max(...tiempos)), HORIZONTE_MAX) }];
    }),
  );
}

async function contextos(db: Db, rangos: ReadonlyMap<string, Rango>): Promise<{ cierres: Map<string, Cierre[]>; contexto: (id: string) => ContextoEspecie }> {
  const especies = [...rangos.keys()];
  const porRango = <C extends string>(campo: C, desdeExclusivo: boolean) =>
    [...rangos].map(([id, r]) => ({ instrumentoId: id, [campo]: desdeExclusivo ? { gt: r.desde, lte: r.hasta } : { gte: r.desde, lte: r.hasta } }));
  const hastaGlobal = new Date(Math.max(...[...rangos.values()].map((r) => r.hasta.getTime())));
  const [cierres, dividendos, movimientos, eventos, cobertura, decretos] = await Promise.all([
    db.precioCierre.findMany({
      where: { fuente: FUENTE_CIERRES, reemplazadoEn: null, OR: porRango("fecha", false) },
      select: { id: true, instrumentoId: true, fecha: true, precio: true, estado: true, fuente: true },
      orderBy: [{ fecha: "asc" }, { id: "asc" }],
    }),
    db.dividendo.findMany({ where: { OR: porRango("fechaPago", true) }, select: { id: true, instrumentoId: true, fechaPago: true, montoNeto: true, tipo: true } }),
    movimientosDeEspecies(db, especies, new Map([...rangos].map(([id, r]) => [id, r.hasta]))),
    db.eventoCorporativo.findMany({
      where: { fecha: { lte: hastaGlobal }, OR: [{ origenId: { in: especies } }, { destinoId: { in: especies } }] },
      // Solo cuentan los lotes de escisión (database-reviewer BAJO): un lote de otro origen no completa la tenencia del destino.
      select: { origenId: true, destinoId: true, fecha: true, _count: { select: { lotes: { where: { origen: "ESCISION" } } } } },
    }),
    cubiertoHasta(db),
    // Siempre, aunque no haya decretos: el número de consultas no depende de cuántas decisiones van en el lote.
    leerFechasDeDecretos(db, rangos),
  ]);
  const porEspecie = {
    cierres: agrupar(cierres, ({ instrumentoId: _, ...c }): Cierre => c),
    dividendos: agrupar(dividendos, ({ instrumentoId: _, ...dv }): DividendoPagado => dv),
    decretos: agrupar(decretos, ({ instrumentoId: _, ...dc }): DecretoDeLaEspecie => dc),
  };
  const contexto = (id: string): ContextoEspecie => ({
    dividendos: porEspecie.dividendos.get(id) ?? [],
    movimientos: movimientos.get(id) ?? [],
    cubiertoHasta: cobertura,
    destinoSinLote: eventos.some((e) => e.destinoId === id && e._count.lotes === 0),
    escisiones: eventos.filter((e) => e.origenId === id).map((e) => e.fecha),
    decretos: porEspecie.decretos.get(id) ?? [],
  });
  return { cierres: porEspecie.cierres, contexto };
}

/** Resultados por id de decisión (los ids que no existen no aparecen). `hoy`: fecha de negocio en Colombia. */
export async function resultadosDeDecisiones(db: Db, ids: readonly string[], hoy: Date): Promise<ReadonlyMap<string, ResultadoDecision>> {
  if (ids.length === 0) return new Map();
  const decisiones = await leerDecisiones(db, ids);
  if (decisiones.length === 0) return new Map();
  const { cierres, contexto } = await contextos(db, rangosPorEspecie(decisiones));
  return new Map(
    decisiones.map((d) => {
      const r = calcularResultados({ accion: d.accion, fechaDecision: d.fechaDecision, cantidad: d.cantidad, ordenes: d.ordenes, cierres: cierres.get(d.instrumentoId) ?? [], especie: contexto(d.instrumentoId), hoy });
      return [d.id, { decisionId: d.id, ...r }];
    }),
  );
}
