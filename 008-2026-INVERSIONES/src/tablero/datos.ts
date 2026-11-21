/**
 * Lee la base de 008 y arma las entradas del tablero (INV-SPEC-15). Solo lectura.
 * Una especie con ventas que sus lotes no cubren (VENTA_SIN_LOTES) no entra en filas, cerradas ni
 * totales: se informa aparte por nemotécnico hasta que se complete la carga de órdenes.
 */
import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { posiciones, type Posicion } from "../lotes/posiciones";
import { calcularTablero, type EntradaEspecie, type Tablero } from "./calculo";
import { calcularMovimiento, calendarioDe, type Movimiento } from "./movimiento";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const DIAS_SERIE = 60;

export interface Resumen {
  /** Trae la fecha de referencia de los cierres (la más reciente entre las vivas), no un máximo global. */
  readonly tablero: Tablero;
  /** «Qué movió»: todas las especies en el mismo par de ruedas (referencia y rueda previa de la BVC). */
  readonly movimiento: Movimiento;
  readonly ultimaCarga: Date | null;
  /** Nemotécnicos de las especies con ventas sin asignar, en orden alfabético. */
  readonly incompletas: readonly string[];
}

type CierreDb = { readonly fecha: Date; readonly precio: Prisma.Decimal; readonly estado: string };

interface Fuentes {
  readonly vivas: ReadonlyMap<string, Posicion>;
  readonly realizada: ReadonlyMap<string, Prisma.Decimal>;
  readonly dividendos: ReadonlyMap<string, Prisma.Decimal>;
  readonly comisiones: ReadonlyMap<string, Prisma.Decimal>;
  readonly series: ReadonlyMap<string, readonly CierreDb[]>;
}

/** Ganancia realizada: ventas FIFO (ingreso prorrateado − costo del lote) y fracciones de escisión (costo 0). */
async function realizadaPorEspecie(db: PrismaClient): Promise<Map<string, Prisma.Decimal>> {
  const [asignaciones, fracciones] = await Promise.all([
    db.asignacionVenta.findMany({
      where: { ordenVenta: { cantidadCompletada: { gt: 0n } } },
      select: { cantidad: true, costoBase: true, ordenVenta: { select: { instrumentoId: true, totalInvertido: true, cantidadCompletada: true } } },
    }),
    db.dividendo.findMany({ where: { tipo: "FRACCION_ESCISION" }, select: { instrumentoId: true, montoNeto: true } }),
  ]);
  const piezas = [
    ...asignaciones.map((a) => {
      const v = a.ordenVenta;
      const ingreso = v.totalInvertido.mul(a.cantidad.toString()).div(v.cantidadCompletada.toString());
      return [v.instrumentoId, ingreso.sub(a.costoBase)] as const;
    }),
    ...fracciones.map((f) => [f.instrumentoId, f.montoNeto] as const),
  ];
  return piezas.reduce((m, [id, v]) => m.set(id, (m.get(id) ?? D(0)).add(v)), new Map<string, Prisma.Decimal>());
}

/** Últimos cierres vigentes de cada especie, del más reciente al más viejo (consultas en paralelo). */
async function seriesPorEspecie(db: PrismaClient, ids: readonly string[]): Promise<Map<string, readonly CierreDb[]>> {
  const series = await Promise.all(
    ids.map((id) =>
      db.precioCierre.findMany({
        where: { instrumentoId: id, reemplazadoEn: null }, orderBy: { fecha: "desc" }, take: DIAS_SERIE, select: { fecha: true, precio: true, estado: true },
      }),
    ),
  );
  return new Map(ids.map((id, k) => [id, series[k] ?? []]));
}

function entrada(i: { readonly id: string; readonly nemotecnico: string | null }, f: Fuentes): EntradaEspecie {
  const viva = f.vivas.get(i.id);
  const serie = f.series.get(i.id) ?? [];
  const ultimo = serie[0];
  return {
    instrumentoId: i.id, nemotecnico: i.nemotecnico ?? "?", cantidad: viva?.cantidad ?? 0n, costoVivo: viva?.costoVivo ?? D(0),
    cierre: ultimo ? { precio: ultimo.precio, fecha: ultimo.fecha, verificado: ultimo.estado === "VERIFICADO" } : null,
    realizada: f.realizada.get(i.id) ?? D(0), dividendos: f.dividendos.get(i.id) ?? D(0), comisiones: f.comisiones.get(i.id) ?? D(0),
    lotesVivos: viva?.lotesVivos ?? 0,
    serie: [...serie].reverse().map((p) => ({ fecha: p.fecha, precio: p.precio })),
  };
}

export async function obtenerResumen(db: PrismaClient): Promise<Resumen> {
  const [pos, realizada, instrumentos, divs, coms, ultimaCarga, noHabiles] = await Promise.all([
    posiciones(db),
    realizadaPorEspecie(db),
    db.instrumento.findMany({ where: { tipo: "ACCION", OR: [{ lotes: { some: {} } }, { dividendos: { some: {} } }] }, select: { id: true, nemotecnico: true } }),
    db.dividendo.groupBy({ by: ["instrumentoId"], where: { tipo: { not: "FRACCION_ESCISION" } }, _sum: { montoNeto: true } }),
    db.orden.groupBy({ by: ["instrumentoId"], where: { estado: "APROBADO", cantidadCompletada: { gt: 0n } }, _sum: { comision: true } }),
    db.cargaArchivo.aggregate({ where: { estado: "CARGADO" }, _max: { cargadoEn: true } }),
    // Tabla sembrada y chica (festivos entre semana de 2022-2027): se lee entera, en paralelo.
    db.calendarioBvc.findMany({ where: { esHabil: false }, select: { dia: true } }),
  ]);
  const incompletas = new Set(pos.especiesIncompletas);
  const completos = instrumentos.filter((i) => !incompletas.has(i.id));
  const [series, nemosIncompletos] = await Promise.all([
    seriesPorEspecie(db, completos.map((i) => i.id)),
    db.instrumento.findMany({ where: { id: { in: [...incompletas] } }, select: { nemotecnico: true } }),
  ]);
  const fuentes: Fuentes = {
    vivas: new Map(pos.posiciones.map((p) => [p.instrumentoId, p])),
    realizada,
    dividendos: new Map(divs.map((d) => [d.instrumentoId, d._sum.montoNeto ?? D(0)])),
    comisiones: new Map(coms.map((c) => [c.instrumentoId, c._sum.comision ?? D(0)])),
    series,
  };
  const tablero = calcularTablero(completos.map((i) => entrada(i, fuentes)));
  return {
    tablero,
    movimiento: calcularMovimiento(tablero.filas, tablero.fechaReferencia, calendarioDe(noHabiles.map((d) => d.dia))),
    ultimaCarga: ultimaCarga._max.cargadoEn ?? null,
    incompletas: nemosIncompletos.map((i) => i.nemotecnico ?? "?").sort((a, b) => a.localeCompare(b)),
  };
}
