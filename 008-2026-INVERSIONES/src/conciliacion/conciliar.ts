/**
 * Concilia una certificación de A&V por su fecha de corte y GUARDA el resultado (Conciliacion + un
 * ControlConciliacion por regla, versión `VERSION_CALCULO`). Cada corrida es una conciliación nueva: la historia
 * queda (las tablas son de solo inserción). Un candado consultivo por fecha de corte serializa las corridas
 * de la misma fecha. Devuelve un resumen con conteos y códigos de motivo, nunca cifras.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { isoDia as dia } from "../importacion/av/fecha-corte";
import { calcularConciliacion, VERSION_CALCULO, type Control } from "./controles";
import { leerEntradas } from "./esperado";
import { corteOcupado } from "./vigente";

/** El candado consultivo de las conciliaciones de un corte (AAAA-MM-DD); la corrección del corte también lo toma. */
export const candadoConciliar = (dia: string): string => `inv008-conciliar-${dia}`;

export class ErrorConciliacion extends Error {
  /** Con CERTIFICACION_RETIRADA: la fecha de corte (AAAA-MM-DD) de la certificación que la reemplazó. */
  constructor(readonly codigo: "SIN_CERTIFICACION" | "CERTIFICACION_RETIRADA", readonly reemplazo: string | null = null) {
    super(codigo === "SIN_CERTIFICACION" ? "No hay certificación con esa fecha de corte." : `La certificación de esa fecha se retiró: su corte real es ${reemplazo}.`);
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
  /** El día hábil anterior si la certificación parece ser la foto de su cierre (fecha_corte_dudosa); si no, null. */
  readonly corteSugerido: string | null;
}

/** La `fechaSugerida` del total de acciones, si la trae. */
function corteSugeridoDe(controles: readonly Control[]): string | null {
  const total = controles.find((c) => c.tipo === "VALOR" && c.instrumentoId === null);
  const fecha = total?.detalle?.fechaSugerida;
  return typeof fecha === "string" ? fecha : null;
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
  return { conciliacionId, fechaCorte: dia(fechaCorte), versionCalculo: VERSION_CALCULO, resultado, cuentas, motivos, corteSugerido: corteSugeridoDe(controles) };
}

export async function conciliarCertificacion(db: PrismaClient, opciones: { readonly fechaCorte: Date }): Promise<ResumenConciliacion> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${candadoConciliar(dia(opciones.fechaCorte))}))`;
      const cert = await corteOcupado(tx, opciones.fechaCorte);
      if (!cert) throw new ErrorConciliacion("SIN_CERTIFICACION");
      // Retirada (corte equivocado): no se concilia sobre ella; la base tampoco lo admitiría.
      if (cert.reemplazo !== null) throw new ErrorConciliacion("CERTIFICACION_RETIRADA", cert.reemplazo);
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
