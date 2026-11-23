import "server-only";
/**
 * Lectores de la tarifa de comisión (O5) y de la historia de órdenes que la contrasta. Solo leen (inv_app, el SELECT
 * general): no importan crear.ts, así la ruta del simulador y la página de /operar no alcanzan ninguna escritura.
 * Los otros cargos vienen del JSON que la CHECK `tarifa_comision_cargos_chk` deja pasar; si uno no tiene esa forma, se
 * lanza (la base cambió por fuera): mejor un error que una comisión inventada.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { COMISIONISTAS, type CargoTarifa, type Comisionista, type OrdenHistorica, type TarifaSimulada } from "../simulador/tipos";

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

/** Todas las versiones, de la más nueva a la más vieja (la historia de la pantalla y la fuente de la vigente). */
export async function leerTarifas(db: Pick<PrismaClient, "tarifaComision">): Promise<TarifaLeida[]> {
  const filas = await db.tarifaComision.findMany({
    orderBy: { version: "desc" },
    select: { version: true, comisionista: true, lado: true, porcentaje: true, minimoPorOrden: true, fijoPorOrden: true, ivaPct: true, otrosCargos: true, vigenteDesde: true, motivo: true, creadaEn: true },
  });
  return filas.map(({ otrosCargos, comisionista, ...f }) => {
    if (!esComisionista(comisionista)) throw new RangeError("Tarifa: un comisionista guardado no es de la lista.");
    return { ...f, comisionista, otrosCargos: cargosDe(otrosCargos) };
  });
}

/** La historia de órdenes que pide la comisión (las de Trii: las cargas de órdenes son TRII_ORDENES). */
export async function leerOrdenesHistoricas(db: Pick<Lector, "orden">): Promise<OrdenHistorica[]> {
  return db.orden.findMany({ select: { lado: true, estado: true, totalInvertido: true, comision: true }, orderBy: { id: "asc" } });
}
