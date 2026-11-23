import "server-only";
/**
 * Lectores de la tarifa de comisión (O5) y de la historia de órdenes que la contrasta. Solo leen (inv_app, el SELECT
 * general): no importan crear.ts, así la ruta del simulador y la página de /operar no alcanzan ninguna escritura.
 * Los otros cargos vienen del JSON que la CHECK `tarifa_comision_cargos_chk` deja pasar; si uno no tiene esa forma, se
 * lanza (la base cambió por fuera): mejor un error que una comisión inventada.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { COMISIONISTAS, type CargoTarifa, type Comisionista, type OrdenHistorica, type TarifaSimulada, type TarifasVigentes } from "../simulador/tipos";

export interface TarifaLeida extends TarifaSimulada {
  readonly motivo: string;
  readonly creadaEn: Date;
}

type Lector = Pick<PrismaClient, "tarifaComision" | "orden">;

const esComisionista = (v: string): v is Comisionista => COMISIONISTAS.some((c) => c === v);

function cargoDe(v: unknown): CargoTarifa {
  const c = typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  const tipo = c?.["tipo"];
  if (c === null || typeof c["nombre"] !== "string" || typeof c["valor"] !== "string" || (tipo !== "PCT" && tipo !== "FIJO")) {
    throw new RangeError("Tarifa: un cargo guardado no tiene la forma de la CHECK.");
  }
  return { nombre: c["nombre"], tipo, valor: new Prisma.Decimal(c["valor"]) };
}

function cargosDe(v: Prisma.JsonValue): CargoTarifa[] {
  if (!Array.isArray(v)) throw new RangeError("Tarifa: los otros cargos guardados no son una lista.");
  return v.map(cargoDe);
}

/** Lo que el motor necesita de una tarifa (sin el motivo ni la hora de la versión). */
const COLUMNAS_TARIFA = { version: true, comisionista: true, lado: true, porcentaje: true, minimoPorOrden: true, fijoPorOrden: true, ivaPct: true, otrosCargos: true, vigenteDesde: true } as const;

/** Una fila de la base como tarifa del motor: el comisionista de la lista y los cargos como Decimal. */
function aTarifa<T extends { readonly comisionista: string; readonly otrosCargos: Prisma.JsonValue }>({ otrosCargos, comisionista, ...f }: T): Omit<T, "comisionista" | "otrosCargos"> & Pick<TarifaSimulada, "comisionista" | "otrosCargos"> {
  if (!esComisionista(comisionista)) throw new RangeError("Tarifa: un comisionista guardado no es de la lista.");
  return { ...f, comisionista, otrosCargos: cargosDe(otrosCargos) };
}

/** Las `cuantas` versiones más nuevas, de la más nueva a la más vieja (la historia de /edicion/tarifas). */
export async function leerTarifas(db: Pick<PrismaClient, "tarifaComision">, cuantas: number): Promise<TarifaLeida[]> {
  const filas = await db.tarifaComision.findMany({ orderBy: { version: "desc" }, take: cuantas, select: { ...COLUMNAS_TARIFA, motivo: true, creadaEn: true } });
  return filas.map(aTarifa);
}

/**
 * Las vigentes de un comisionista en el día (medianoche UTC), por lado: la de mayor versión con «vigente desde» hasta ese
 * día (la regla de vigente.ts), una por lado, sin el motivo (revisión de base: no se lee toda la historia).
 */
export async function leerTarifasVigentes(db: Pick<PrismaClient, "tarifaComision">, comisionista: Comisionista, dia: Date): Promise<TarifasVigentes> {
  const filas = await db.tarifaComision.findMany({
    where: { comisionista, vigenteDesde: { lte: dia } },
    orderBy: [{ lado: "asc" }, { version: "desc" }],
    distinct: ["lado"],
    select: COLUMNAS_TARIFA,
  });
  return Object.fromEntries(filas.map((f) => [f.lado, aTarifa(f)]));
}

/**
 * La historia de órdenes que cuenta para la comisión y su control: solo las aprobadas con valor (revisión de base: no
 * todas). Son de Trii: las cargas de órdenes son TRII_ORDENES.
 */
export async function leerOrdenesHistoricas(db: Pick<Lector, "orden">): Promise<OrdenHistorica[]> {
  const filas = await db.orden.findMany({ where: { estado: "APROBADO", totalInvertido: { gt: 0 } }, select: { fechaOperacion: true, lado: true, estado: true, totalInvertido: true, comision: true } });
  return filas.map(({ fechaOperacion, ...o }) => ({ ...o, fecha: fechaOperacion }));
}
