/**
 * Órdenes aprobadas sin decisión registrada. Orden es de solo inserción y no admite una bandera:
 * la marca se deriva (aprobada y sin ningún enlace). Las anteriores a la vigencia de la v1 del plan
 * van aparte, «anteriores al plan», sin alarma (P5 de la GATE 1). Las canceladas no cuentan.
 */
import type { LadoOrden } from "@prisma/client";
import type { Db } from "./acceso";

export interface OrdenSinDecision {
  readonly id: string;
  /** Fila importada de donde salió (trazabilidad hasta el archivo): su número y cuándo se cargó. */
  readonly filaFuenteId: string;
  readonly filaNo: number;
  readonly cargadaEn: Date;
  readonly instrumentoId: string;
  readonly nemotecnico: string | null;
  readonly fechaOperacion: Date;
  readonly lado: LadoOrden;
  readonly cantidadCompletada: bigint;
}

export interface OrdenesSinDecision {
  /** `vigenteDesde` de la v1; nulo si todavía no hay plan (entonces todas son anteriores). */
  readonly inicioPlan: Date | null;
  readonly sinDecision: readonly OrdenSinDecision[];
  readonly anterioresAlPlan: readonly OrdenSinDecision[];
}

export async function listarOrdenesSinDecision(db: Db): Promise<OrdenesSinDecision> {
  const primera = await db.planVersion.findFirst({ orderBy: { version: "asc" }, select: { vigenteDesde: true } });
  const filas = await db.orden.findMany({
    where: { estado: "APROBADO", enlacesDecision: { none: {} } },
    select: {
      id: true, filaFuenteId: true, instrumentoId: true, fechaOperacion: true, lado: true, cantidadCompletada: true,
      instrumento: { select: { nemotecnico: true } },
      filaFuente: { select: { primeraFilaNo: true, primeraCarga: { select: { cargadoEn: true } } } },
    },
    orderBy: [{ fechaOperacion: "asc" }, { id: "asc" }],
  });
  const ordenes = filas.map(({ instrumento, filaFuente, ...o }): OrdenSinDecision => ({
    ...o, nemotecnico: instrumento.nemotecnico, filaNo: filaFuente.primeraFilaNo, cargadaEn: filaFuente.primeraCarga.cargadoEn,
  }));
  const inicioPlan = primera?.vigenteDesde ?? null;
  const anterior = (o: OrdenSinDecision) => inicioPlan === null || o.fechaOperacion < inicioPlan;
  return { inicioPlan, sinDecision: ordenes.filter((o) => !anterior(o)), anterioresAlPlan: ordenes.filter(anterior) };
}
