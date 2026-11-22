/**
 * Concilia una certificación de A&V por su fecha de corte y GUARDA el resultado (Conciliacion + un
 * ControlConciliacion por regla, versión `VERSION_CALCULO`). Cada corrida es una conciliación nueva: la historia
 * queda (las tablas son de solo inserción). Un candado consultivo por fecha de corte serializa las corridas
 * de la misma fecha. Devuelve un resumen con conteos y códigos de motivo, nunca cifras.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { isoDia as dia } from "../importacion/av/fecha-corte";
import { candadoConciliar } from "../lib/candados";
import { calcularConciliacion, VERSION_CALCULO, type Control } from "./controles";
import { leerEntradas } from "./esperado";
import { corteOcupado } from "./vigente";

export { candadoConciliar };

/**
 * Intentos ante una serialización (P2034): la instantánea se toma antes de esperar el candado (database-reviewer MEDIO).
 * El caso conocido es el retiro de la certificación mientras se espera, pero se repite cualquier P2034, una sola vez:
 * la transacción fallida se deshizo entera, así que no se duplica nada.
 */
const MAX_INTENTOS = 2;
const esSerializacion = (e: unknown): boolean => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034";

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

/**
 * Concilia en REPEATABLE READ. La instantánea se toma con la primera sentencia (el candado), ANTES de esperarlo: si
 * mientras espera otra transacción retira la certificación (corrección del corte), el disparador de la base hace fallar
 * el INSERT (P2034) y se repite UNA vez, ya con una instantánea nueva que ve el retiro (CERTIFICACION_RETIRADA). Otro
 * P2034 también se repite una vez; uno segundo, o cualquier otro error, sale tal cual.
 */
export async function conciliarCertificacion(db: PrismaClient, opciones: { readonly fechaCorte: Date }): Promise<ResumenConciliacion> {
  for (let intento = 1; ; intento += 1) {
    try {
      return await conciliarUnaVez(db, opciones);
    } catch (e) {
      if (!esSerializacion(e) || intento >= MAX_INTENTOS) throw e;
    }
  }
}

function conciliarUnaVez(db: PrismaClient, opciones: { readonly fechaCorte: Date }): Promise<ResumenConciliacion> {
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
