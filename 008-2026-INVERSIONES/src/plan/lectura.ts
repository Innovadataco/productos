/**
 * Lecturas del plan y del diario de decisiones para las pantallas `/plan`, `/decisiones` y `/decisiones/[id]`
 * (fase B, corte 3). Solo lectura y con `select` explícito: nunca el crudo de las filas importadas. El diario y el
 * detalle se leen en una sola instantánea (REPEATABLE READ de solo lectura), con los resultados del lote.
 */
import "server-only";
import type { AccionPlan, CondicionRegla, EstadoPrecio, LadoOrden, Prisma, PrismaClient } from "@prisma/client";
import { enSoloLectura } from "@/conciliacion/leer";
import { leerCalendario, type CalendarioBvc } from "@/precios/negociacion";
import type { Db } from "./acceso";
import { resultadosDeDecisiones, type ResultadoDecision } from "./resultados-lote";
import { listarOrdenesSinDecision, type OrdenesSinDecision } from "./sin-decision";

/** Cuántas decisiones muestra el diario (las más recientes); si hay más, la pantalla lo dice. */
export const TOPE_DIARIO = 500;

export interface VersionLeida {
  readonly id: string;
  readonly version: number;
  readonly vigenteDesde: Date;
  readonly motivo: string;
  readonly creadaEn: Date;
  readonly reglas: number;
}

export interface ReglaLeida {
  readonly id: string;
  readonly instrumentoId: string | null;
  readonly nemotecnico: string | null;
  /** La especie tiene lotes (solo de esas se traen cierres). */
  readonly conLotes: boolean;
  readonly condicion: CondicionRegla;
  readonly nivel: Prisma.Decimal | null;
  readonly accion: AccionPlan;
  readonly cantidad: bigint | null;
  readonly plazoHasta: Date | null;
  readonly detalle: string;
  /** Decisiones que citan la regla. */
  readonly decisiones: number;
}

export interface CierreLeido {
  readonly fecha: Date;
  readonly precio: Prisma.Decimal;
  readonly estado: EstadoPrecio;
  /**
   * Cuándo lo trajo 008 y de qué fuente (frente fecha-hora-datos). Opcionales a propósito (cambio aditivo): quien arma
   * un cierre sin ellos sigue compilando; `ultimosCierres` siempre los trae.
   */
  readonly traidoEn?: Date;
  readonly fuente?: string;
}

export interface ReglaCitada {
  readonly id: string;
  readonly condicion: CondicionRegla;
  readonly nivel: Prisma.Decimal | null;
  readonly accion: AccionPlan;
  readonly nemotecnico: string | null;
}

export interface DecisionLeida {
  readonly id: string;
  readonly fechaDecision: Date;
  readonly registradaEn: Date;
  readonly accion: AccionPlan;
  readonly cantidad: bigint | null;
  readonly excepcion: boolean;
  readonly motivo: string;
  readonly nemotecnico: string | null;
  readonly version: { readonly numero: number; readonly vigenteDesde: Date; readonly motivo: string };
  readonly regla: ReglaCitada | null;
  /** Órdenes con enlace vigente. */
  readonly ordenes: number;
  readonly reemplaza: { readonly id: string; readonly fechaDecision: Date } | null;
  readonly reemplazadaPor: { readonly id: string; readonly fechaDecision: Date } | null;
}

export interface DiarioLeido {
  readonly decisiones: readonly DecisionLeida[];
  readonly truncado: boolean;
  /** Solo de las decisiones vigentes (las reemplazadas no se miden: sus órdenes pasaron a la corrección). */
  readonly resultados: ReadonlyMap<string, ResultadoDecision>;
  readonly sinDecision: OrdenesSinDecision;
}

export interface OrdenEnlazada {
  readonly id: string;
  readonly fechaOperacion: Date;
  readonly lado: LadoOrden;
  readonly cantidadCompletada: bigint;
  readonly totalEstimado: Prisma.Decimal;
  readonly filaNo: number;
  readonly cargadaEn: Date;
}

export interface EnlaceLeido {
  readonly id: string;
  readonly creadoEn: Date;
  readonly motivo: string | null;
  readonly vigente: boolean;
  readonly ordenFecha: Date;
  readonly ordenLado: LadoOrden;
}

export interface DetalleLeido {
  readonly decision: DecisionLeida;
  readonly ordenes: readonly OrdenEnlazada[];
  readonly enlaces: readonly EnlaceLeido[];
  /** null si la decisión fue reemplazada. */
  readonly resultado: ResultadoDecision | null;
}

export async function leerVersiones(db: Db): Promise<VersionLeida[]> {
  const filas = await db.planVersion.findMany({
    select: { id: true, version: true, vigenteDesde: true, motivo: true, creadaEn: true, _count: { select: { reglas: true } } },
    orderBy: { version: "desc" },
  });
  return filas.map(({ _count, ...v }) => ({ ...v, reglas: _count.reglas }));
}

export async function leerReglas(db: Db, planVersionId: string): Promise<ReglaLeida[]> {
  const filas = await db.reglaPlan.findMany({
    where: { planVersionId },
    select: {
      id: true, instrumentoId: true, condicion: true, nivel: true, accion: true, cantidad: true, plazoHasta: true, detalle: true,
      instrumento: { select: { nemotecnico: true, _count: { select: { lotes: true } } } },
      _count: { select: { decisiones: true } },
    },
    orderBy: { id: "asc" },
  });
  return filas.map(({ instrumento, _count, ...r }) => ({ ...r, nemotecnico: instrumento?.nemotecnico ?? null, conLotes: (instrumento?._count.lotes ?? 0) > 0, decisiones: _count.decisiones }));
}

/**
 * El último cierre vigente de cada especie, de cualquier fuente (la regla del tablero), en UNA consulta
 * (database-reviewer MEDIO: no una por especie). `DISTINCT ON` con desempate total; los ids van parametrizados.
 */
export async function ultimosCierres(db: Db, ids: readonly string[]): Promise<ReadonlyMap<string, CierreLeido>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map();
  const filas = await db.$queryRaw<(CierreLeido & { readonly instrumentoId: string })[]>`
    SELECT DISTINCT ON ("instrumentoId") "instrumentoId", "fecha", "precio", "estado"::text AS "estado", "fuente", "traidoEn"
    FROM "precio_cierre"
    WHERE "instrumentoId" = ANY(${unicos}::text[]) AND "reemplazadoEn" IS NULL
    ORDER BY "instrumentoId", "fecha" DESC, "traidoEn" DESC, "id" DESC`;
  return new Map(filas.map(({ instrumentoId, ...c }) => [instrumentoId, c]));
}

/** calendario_bvc es chica (festivos de 2022 a 2027): se lee entera. */
export async function calendarioBvc(db: Db): Promise<CalendarioBvc> {
  return leerCalendario(await db.calendarioBvc.findMany({ select: { dia: true, esHabil: true } }));
}

const SELECT_DECISION = {
  id: true, fechaDecision: true, registradaEn: true, accion: true, cantidad: true, excepcion: true, motivo: true,
  instrumento: { select: { nemotecnico: true } },
  planVersion: { select: { version: true, vigenteDesde: true, motivo: true } },
  regla: { select: { id: true, condicion: true, nivel: true, accion: true, instrumento: { select: { nemotecnico: true } } } },
  reemplaza: { select: { id: true, fechaDecision: true } },
  reemplazadaPor: { select: { id: true, fechaDecision: true } },
  _count: { select: { enlaces: { where: { reemplazadoPor: { is: null } } } } },
} satisfies Prisma.DecisionSelect;

type FilaDecision = Prisma.DecisionGetPayload<{ select: typeof SELECT_DECISION }>;

function aDecision(f: FilaDecision): DecisionLeida {
  return {
    id: f.id, fechaDecision: f.fechaDecision, registradaEn: f.registradaEn, accion: f.accion, cantidad: f.cantidad, excepcion: f.excepcion, motivo: f.motivo,
    nemotecnico: f.instrumento.nemotecnico,
    version: { numero: f.planVersion.version, vigenteDesde: f.planVersion.vigenteDesde, motivo: f.planVersion.motivo },
    regla: f.regla ? { id: f.regla.id, condicion: f.regla.condicion, nivel: f.regla.nivel, accion: f.regla.accion, nemotecnico: f.regla.instrumento?.nemotecnico ?? null } : null,
    ordenes: f._count.enlaces,
    reemplaza: f.reemplaza,
    reemplazadaPor: f.reemplazadaPor,
  };
}

/** La regla, si existe, con su versión y su especie (para el filtro del diario). */
export async function reglaPorId(db: Db, id: string): Promise<{ readonly id: string; readonly version: number; readonly nemotecnico: string | null } | null> {
  const r = await db.reglaPlan.findUnique({ where: { id }, select: { id: true, planVersion: { select: { version: true } }, instrumento: { select: { nemotecnico: true } } } });
  return r ? { id: r.id, version: r.planVersion.version, nemotecnico: r.instrumento?.nemotecnico ?? null } : null;
}

export function leerDiario(db: PrismaClient, hoy: Date, reglaId: string | null): Promise<DiarioLeido> {
  return enSoloLectura(db, async (tx) => {
    const filas = await tx.decision.findMany({
      where: reglaId === null ? {} : { reglaId },
      select: SELECT_DECISION,
      orderBy: [{ fechaDecision: "desc" }, { registradaEn: "desc" }, { id: "desc" }],
      take: TOPE_DIARIO + 1,
    });
    const decisiones = filas.slice(0, TOPE_DIARIO).map(aDecision);
    const vigentes = decisiones.filter((d) => d.reemplazadaPor === null).map((d) => d.id);
    const [resultados, sinDecision] = await Promise.all([resultadosDeDecisiones(tx, vigentes, hoy), listarOrdenesSinDecision(tx)]);
    return { decisiones, truncado: filas.length > TOPE_DIARIO, resultados, sinDecision };
  });
}

export function leerDecision(db: PrismaClient, id: string, hoy: Date): Promise<DetalleLeido | null> {
  return enSoloLectura(db, async (tx) => {
    const fila = await tx.decision.findUnique({ where: { id }, select: SELECT_DECISION });
    if (!fila) return null;
    const decision = aDecision(fila);
    const enlaces = await tx.enlaceDecisionOrden.findMany({
      where: { decisionId: id },
      select: {
        id: true, creadoEn: true, motivo: true, reemplazadoPor: { select: { id: true } },
        orden: { select: { id: true, fechaOperacion: true, lado: true, cantidadCompletada: true, totalEstimado: true, filaFuente: { select: { primeraFilaNo: true, primeraCarga: { select: { cargadoEn: true } } } } } },
      },
      orderBy: [{ creadoEn: "asc" }, { id: "asc" }],
    });
    const vigentes = enlaces.filter((e) => e.reemplazadoPor === null).map((e) => e.orden);
    const resultado = decision.reemplazadaPor === null ? ((await resultadosDeDecisiones(tx, [id], hoy)).get(id) ?? null) : null;
    return {
      decision,
      ordenes: vigentes
        .map((o) => ({ id: o.id, fechaOperacion: o.fechaOperacion, lado: o.lado, cantidadCompletada: o.cantidadCompletada, totalEstimado: o.totalEstimado, filaNo: o.filaFuente.primeraFilaNo, cargadaEn: o.filaFuente.primeraCarga.cargadoEn }))
        .sort((a, b) => a.fechaOperacion.getTime() - b.fechaOperacion.getTime()),
      enlaces: enlaces.map((e) => ({ id: e.id, creadoEn: e.creadoEn, motivo: e.motivo, vigente: e.reemplazadoPor === null, ordenFecha: e.orden.fechaOperacion, ordenLado: e.orden.lado })),
      resultado,
    };
  });
}
