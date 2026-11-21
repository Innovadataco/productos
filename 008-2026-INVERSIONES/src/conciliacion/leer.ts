/**
 * Lectura de la conciliación para la pantalla `/conciliacion` y la línea del tablero (PR-C, GATE 1 aprobada).
 * Solo lectura y con `select` explícito: nunca el encargo, la cuenta, el titular ni el crudo.
 * - `leerConciliacion`: la última conciliación guardada del corte; si sigue al día frente a un recálculo con las
 *   mismas reglas (AL_DIA / DESACTUALIZADA, o NO_SE_PUDO_COMPROBAR si el recálculo falla: lo guardado se muestra
 *   igual), y las operaciones por liquidar (T+2) leídas en vivo con el mismo criterio que el cálculo. Todo en una
 *   transacción REPEATABLE READ de solo lectura (una sola instantánea), sin el candado de `conciliar`.
 * - `cortesDisponibles` y `ultimaConciliacion`: los cortes cargados y el resultado de su última corrida.
 */
import "server-only";
import { Prisma, type PrismaClient, type ResultadoConciliacion, type TipoInstrumento } from "@prisma/client";
import { calcularConciliacion, VERSION_CALCULO } from "./controles";
import { leerEntradas, ordenesAlCorte } from "./esperado";
import { mismaConciliacion, type ControlGuardado } from "./frescura";

type Lector = Prisma.TransactionClient;

/** Cuántos cortes ofrece el selector de la pantalla. */
export const MAX_CORTES = 60;
/** Tope de la transacción por visita (security-reviewer MEDIO): una sola persona con sesión, pero acotado. */
const TIEMPO_MAXIMO_MS = 15_000;
const ESPERA_MAXIMA_MS = 10_000;
const MAS_RECIENTE = [{ calculadaEn: "desc" }, { id: "desc" }] satisfies Prisma.ConciliacionOrderByWithRelationInput[];

export type Frescura = "AL_DIA" | "DESACTUALIZADA" | "NO_SE_PUDO_COMPROBAR";

export interface CorteDisponible {
  readonly fechaCorte: Date;
  /** Resultado de la última conciliación de ese corte; null si todavía no se concilió. */
  readonly resultado: ResultadoConciliacion | null;
}

export interface InstrumentoLeido {
  readonly nemotecnico: string | null;
  readonly nombre: string;
  readonly tipo: TipoInstrumento;
}

export interface ControlLeido extends ControlGuardado {
  readonly instrumento: InstrumentoLeido | null;
}

export interface ConciliacionLeida {
  readonly id: string;
  readonly fechaCorte: Date;
  readonly calculadaEn: Date;
  readonly versionCalculo: string;
  readonly resultado: ResultadoConciliacion;
  readonly controles: readonly ControlLeido[];
}

export interface PorLiquidar {
  readonly nemotecnico: string;
  readonly operacion: "COMPRA" | "VENTA" | "ESCISION";
  readonly cantidad: bigint;
  readonly fechaOperacion: Date;
  readonly fechaLiquidacion: Date;
}

export interface LecturaConciliacion {
  readonly fechaCorte: Date;
  /** null: la certificación está cargada pero todavía no se concilió. */
  readonly conciliacion: ConciliacionLeida | null;
  readonly frescura: Frescura | null;
  /** Operaciones hechas hasta el corte que se liquidan después, según las órdenes que hay hoy en el sistema. */
  readonly porLiquidar: readonly PorLiquidar[];
}

/** Una transacción REPEATABLE READ de solo lectura: la base rechaza cualquier escritura adentro. */
export function enSoloLectura<T>(db: PrismaClient, leer: (tx: Lector) => Promise<T>): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return leer(tx);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: TIEMPO_MAXIMO_MS, maxWait: ESPERA_MAXIMA_MS },
  );
}

const ultimaDelCorte = (tx: Lector, certificacionId: string): Promise<ConciliacionLeida | null> =>
  tx.conciliacion.findFirst({
    where: { certificacionId },
    orderBy: MAS_RECIENTE,
    select: {
      id: true, fechaCorte: true, calculadaEn: true, versionCalculo: true, resultado: true,
      controles: {
        select: {
          tipo: true, instrumentoId: true, esperado: true, real: true, diferencia: true, tolerancia: true, resultado: true, codigoMotivo: true, detalle: true,
          instrumento: { select: { nemotecnico: true, nombre: true, tipo: true } },
        },
      },
    },
  });

async function porLiquidarAlCorte(tx: Lector, corte: Date): Promise<PorLiquidar[]> {
  const ordenes = (await ordenesAlCorte(tx, corte)).filter((o) => o.fechaLiquidacion > corte);
  const lotes = await tx.lote.findMany({
    where: { origen: "ESCISION", fechaCompra: { lte: corte }, fechaLiquidacion: { gt: corte } },
    select: { instrumentoId: true, cantidad: true, fechaCompra: true, fechaLiquidacion: true },
  });
  const ids = [...new Set([...ordenes.map((o) => o.instrumentoId), ...lotes.map((l) => l.instrumentoId)])];
  const instrumentos = await tx.instrumento.findMany({ where: { id: { in: ids } }, select: { id: true, nemotecnico: true, nombre: true } });
  const nombre = new Map(instrumentos.map((i) => [i.id, i.nemotecnico ?? i.nombre]));
  const filas: PorLiquidar[] = [
    ...ordenes.map((o) => ({ nemotecnico: nombre.get(o.instrumentoId) ?? "", operacion: o.lado, cantidad: o.cantidadCompletada, fechaOperacion: o.fechaOperacion, fechaLiquidacion: o.fechaLiquidacion })),
    ...lotes.map((l) => ({ nemotecnico: nombre.get(l.instrumentoId) ?? "", operacion: "ESCISION" as const, cantidad: l.cantidad, fechaOperacion: l.fechaCompra, fechaLiquidacion: l.fechaLiquidacion })),
  ];
  return filas.sort((a, b) => a.fechaOperacion.getTime() - b.fechaOperacion.getTime() || (a.nemotecnico < b.nemotecnico ? -1 : a.nemotecnico > b.nemotecnico ? 1 : 0));
}

/** Nombre (y código, si lo trae) del error: nunca el mensaje, que puede traer datos. */
function nombreDeError(e: unknown): string {
  if (!(e instanceof Error)) return "desconocido";
  const codigo = (e as { code?: unknown }).code;
  return typeof codigo === "string" ? `${e.name}/${codigo}` : e.name;
}

async function frescuraDe(tx: Lector, certificacionId: string, guardada: ConciliacionLeida): Promise<Frescura> {
  try {
    const { entradas } = await leerEntradas(tx, certificacionId);
    return mismaConciliacion(guardada, { versionCalculo: VERSION_CALCULO, ...calcularConciliacion(entradas) }) ? "AL_DIA" : "DESACTUALIZADA";
  } catch (e) {
    console.error(`[conciliacion] no se pudo comprobar si está al día (error: ${nombreDeError(e)})`);
    return "NO_SE_PUDO_COMPROBAR";
  }
}

export function leerConciliacion(db: PrismaClient, fechaCorte: Date): Promise<LecturaConciliacion | null> {
  return enSoloLectura(db, async (tx) => {
    const cert = await tx.certificacion.findUnique({ where: { fechaCorte }, select: { id: true, fechaCorte: true } });
    if (!cert) return null;
    const conciliacion = await ultimaDelCorte(tx, cert.id);
    const porLiquidar = await porLiquidarAlCorte(tx, cert.fechaCorte);
    // El recálculo va al final: si falla, lo demás ya se leyó.
    const frescura = conciliacion === null ? null : await frescuraDe(tx, cert.id, conciliacion);
    return { fechaCorte: cert.fechaCorte, conciliacion, frescura, porLiquidar };
  });
}

const cortes = (db: PrismaClient, cuantos: number): Promise<CorteDisponible[]> =>
  db.certificacion
    .findMany({
      orderBy: { fechaCorte: "desc" },
      take: cuantos,
      select: { fechaCorte: true, conciliaciones: { select: { resultado: true }, orderBy: MAS_RECIENTE, take: 1 } },
    })
    .then((filas) => filas.map((f) => ({ fechaCorte: f.fechaCorte, resultado: f.conciliaciones[0]?.resultado ?? null })));

export const cortesDisponibles = (db: PrismaClient): Promise<CorteDisponible[]> => cortes(db, MAX_CORTES);

/** El corte más reciente y el resultado de su última conciliación (la línea del tablero). Sin recalcular. */
export const ultimaConciliacion = async (db: PrismaClient): Promise<CorteDisponible | null> => (await cortes(db, 1))[0] ?? null;
