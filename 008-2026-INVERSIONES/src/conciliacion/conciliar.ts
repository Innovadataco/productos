/**
 * Concilia una certificación de A&V por su fecha de corte y GUARDA el resultado (Conciliacion + un
 * ControlConciliacion por regla, versión `conciliacion-v1`). Cada corrida es una conciliación nueva: la historia
 * queda (las tablas son de solo inserción). Un candado consultivo por fecha de corte serializa las corridas
 * de la misma fecha. Devuelve un resumen con conteos y códigos de motivo, nunca cifras.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { isoDia as dia } from "../importacion/av/fecha-corte";
import { calcularConciliacion, VERSION_CALCULO, type Control } from "./controles";
import { leerEntradas } from "./esperado";

export class ErrorConciliacion extends Error {
  constructor(readonly codigo: "SIN_CERTIFICACION") {
    super(codigo === "SIN_CERTIFICACION" ? "No hay certificación con esa fecha de corte." : codigo);
    this.name = "ErrorConciliacion";
  }
}

export interface ResumenConciliacion {
  readonly conciliacionId: string;
  readonly fechaCorte: string;
  readonly versionCalculo: string;
  readonly resultado: "CUADRA" | "NO_CUADRA" | "PARCIAL";
  readonly cuentas: Readonly<Record<Control["resultado"], number>>;
  /** Códigos de motivo distintos, en orden alfabético. */
  readonly motivos: readonly string[];
}

function filaDeControl(conciliacionId: string, c: Control): Prisma.ControlConciliacionCreateManyInput {
  return {
    conciliacionId, tipo: c.tipo, instrumentoId: c.instrumentoId, esperado: c.esperado, real: c.real, diferencia: c.diferencia,
    tolerancia: c.tolerancia, resultado: c.resultado, codigoMotivo: c.codigoMotivo, detalle: c.detalle ?? undefined,
  };
}

function resumen(conciliacionId: string, fechaCorte: Date, resultado: ResumenConciliacion["resultado"], controles: readonly Control[]): ResumenConciliacion {
  const cuentas = { CUADRA: 0, NO_CUADRA: 0, PENDIENTE_LIQUIDACION: 0 };
  for (const c of controles) cuentas[c.resultado] += 1;
  const motivos = [...new Set(controles.flatMap((c) => (c.codigoMotivo ? [c.codigoMotivo] : [])))].sort();
  return { conciliacionId, fechaCorte: dia(fechaCorte), versionCalculo: VERSION_CALCULO, resultado, cuentas, motivos };
}

export async function conciliarCertificacion(db: PrismaClient, opciones: { readonly fechaCorte: Date }): Promise<ResumenConciliacion> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`inv008-conciliar-${dia(opciones.fechaCorte)}`}))`;
      const cert = await tx.certificacion.findUnique({ where: { fechaCorte: opciones.fechaCorte }, select: { id: true } });
      if (!cert) throw new ErrorConciliacion("SIN_CERTIFICACION");
      const { fechaCorte, entradas } = await leerEntradas(tx, cert.id);
      const { resultado, controles } = calcularConciliacion(entradas);
      const conciliacion = await tx.conciliacion.create({ data: { certificacionId: cert.id, fechaCorte, versionCalculo: VERSION_CALCULO, resultado }, select: { id: true } });
      await tx.controlConciliacion.createMany({ data: controles.map((c) => filaDeControl(conciliacion.id, c)) });
      return resumen(conciliacion.id, fechaCorte, resultado, controles);
    },
    // Una sola instantánea para todas las lecturas: una importación que confirma en medio no mezcla el resultado.
    { timeout: 60_000, maxWait: 10_000, isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
