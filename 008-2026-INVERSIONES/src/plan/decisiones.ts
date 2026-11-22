/**
 * Diario de decisiones: qué se decidió (comprar, vender o no actuar), por qué, quién y cuándo, bajo la
 * versión del plan vigente ese día y, si aplica, citando su regla. Una decisión no se edita: se
 * corrige con otra que la reemplaza, y sus órdenes pasan a la nueva con un enlace de corrección.
 */
import type { AccionPlan, Prisma, PrismaClient } from "@prisma/client";
import { exigirDueno } from "./acceso";
import { bloquearDecision, bloquearVersiones } from "./bloqueos";
import { CHOQUES_ENLACE, escribirEnlace, exigirEnlaceCoherente } from "./enlaces";
import { ErrorPlan, exigirSinErrores, traducirChoque } from "./errores";
import { validarDecision, validarDecisionContraRegla, type DatosDecisionValidable } from "./validar";
import { hoyDe, versionVigente, type OpcionesPlan } from "./versiones";

export interface DatosDecision {
  readonly fechaDecision: Date;
  readonly instrumentoId: string;
  readonly accion: AccionPlan;
  readonly cantidad?: bigint | null;
  readonly reglaId?: string | null;
  /** Se aparta de la acción de la regla citada (P7: la excepción cita la regla, con motivo). */
  readonly excepcion?: boolean;
  readonly motivo: string;
  readonly autorId: string;
}

export interface DecisionRegistrada {
  readonly id: string;
  readonly planVersionId: string;
  readonly version: number;
}

// El orden importa: el choque del enlace movido también nombra «reemplazaId», junto con «ordenId».
export const CHOQUES_CORRECCION: Readonly<Record<string, string>> = { ordenId: "ENLACE_YA_REEMPLAZADO", reemplazaId: "DECISION_YA_REEMPLAZADA" };

function normalizar(d: DatosDecision): DatosDecisionValidable {
  return {
    fechaDecision: d.fechaDecision,
    instrumentoId: d.instrumentoId,
    accion: d.accion,
    cantidad: d.cantidad ?? null,
    reglaId: d.reglaId ?? null,
    excepcion: d.excepcion ?? false,
    motivo: typeof d.motivo === "string" ? d.motivo.trim() : d.motivo,
  };
}

/** Resuelve la versión vigente en la fecha de la decisión y comprueba la especie y la regla. */
async function resolverCadena(db: Prisma.TransactionClient, d: DatosDecisionValidable): Promise<{ planVersionId: string; version: number }> {
  const version = await versionVigente(db, d.fechaDecision);
  if (!version) throw new ErrorPlan("SIN_PLAN");
  const instrumento = await db.instrumento.findUnique({ where: { id: d.instrumentoId }, select: { id: true } });
  if (!instrumento) throw new ErrorPlan("INSTRUMENTO_INEXISTENTE");
  if (d.reglaId !== null) {
    const regla = await db.reglaPlan.findUnique({ where: { id: d.reglaId }, select: { planVersionId: true, instrumentoId: true, accion: true } });
    if (!regla) throw new ErrorPlan("REGLA_INEXISTENTE");
    const errores = validarDecisionContraRegla(d, regla, version.id);
    if (errores[0]) throw new ErrorPlan(errores[0].codigo, errores);
  }
  return { planVersionId: version.id, version: version.version };
}

async function escribirDecision(db: Prisma.TransactionClient, d: DatosDecisionValidable, autorId: string, reemplazaId: string | null): Promise<DecisionRegistrada> {
  // Compartido: una versión nueva en curso termina antes de leer la vigente (no se cuela).
  await bloquearVersiones(db, "compartido");
  const cadena = await resolverCadena(db, d);
  const creada = await db.decision.create({
    data: { ...d, planVersionId: cadena.planVersionId, decididaPorId: autorId, reemplazaId },
    select: { id: true },
  });
  return { id: creada.id, ...cadena };
}

async function preparar(db: PrismaClient, d: DatosDecision, opciones: OpcionesPlan): Promise<DatosDecisionValidable> {
  const datos = normalizar(d);
  exigirSinErrores(validarDecision(datos, hoyDe(opciones)));
  await exigirDueno(db, d.autorId);
  return datos;
}

export async function registrarDecision(db: PrismaClient, d: DatosDecision, opciones: OpcionesPlan = {}): Promise<DecisionRegistrada> {
  const datos = await preparar(db, d, opciones);
  return db.$transaction((tx) => escribirDecision(tx, datos, d.autorId, null));
}

/**
 * Registra la decisión y la enlaza a la orden de Trii que la ejecutó, en UNA transacción: si la orden no es coherente
 * con la decisión (especie, lado, fecha, aprobada) o ya tiene decisión, no queda ni la decisión. Para registrar a la
 * vez una decisión y la orden que ya se importó (el enlace posterior es `enlazarOrden`).
 */
export async function registrarDecisionConOrden(
  db: PrismaClient,
  d: DatosDecision,
  ordenId: string,
  opciones: OpcionesPlan = {},
): Promise<DecisionRegistrada & { readonly enlaceId: string }> {
  const datos = await preparar(db, d, opciones);
  try {
    return await db.$transaction(async (tx) => {
      const nueva = await escribirDecision(tx, datos, d.autorId, null);
      const orden = await tx.orden.findUnique({ where: { id: ordenId }, select: { estado: true, instrumentoId: true, lado: true, fechaOperacion: true } });
      if (!orden) throw new ErrorPlan("ORDEN_INEXISTENTE");
      exigirEnlaceCoherente(orden, { ...datos, reemplazada: false });
      const enlace = await escribirEnlace(tx, { ordenId, decisionId: nueva.id, autorId: d.autorId, motivo: null });
      return { ...nueva, enlaceId: enlace.id };
    });
  } catch (error) {
    throw traducirChoque(error, CHOQUES_ENLACE);
  }
}

/**
 * Registra `d` como corrección de `decisionId` y mueve a la nueva los enlaces vigentes de la anterior.
 * Si alguna de esas órdenes no es coherente con la nueva decisión, no se guarda nada.
 */
export async function corregirDecision(
  db: PrismaClient,
  decisionId: string,
  d: DatosDecision,
  opciones: OpcionesPlan = {},
): Promise<DecisionRegistrada & { readonly enlacesMovidos: number }> {
  const datos = await preparar(db, d, opciones);
  try {
    return await db.$transaction(async (tx) => {
      // El candado de la anterior (src/plan/bloqueos.ts): un enlace en curso termina antes y se mueve también.
      if (!(await bloquearDecision(tx, decisionId))) throw new ErrorPlan("DECISION_INEXISTENTE");
      const anterior = await tx.decision.findUnique({ where: { id: decisionId }, select: { id: true, reemplazadaPor: { select: { id: true } } } });
      if (!anterior) throw new ErrorPlan("DECISION_INEXISTENTE");
      if (anterior.reemplazadaPor) throw new ErrorPlan("DECISION_YA_REEMPLAZADA");
      const nueva = await escribirDecision(tx, datos, d.autorId, anterior.id);
      const enlaces = await tx.enlaceDecisionOrden.findMany({
        where: { decisionId: anterior.id, reemplazadoPor: { is: null } },
        select: { orden: { select: { id: true, estado: true, instrumentoId: true, lado: true, fechaOperacion: true } } },
        orderBy: [{ creadoEn: "asc" }, { id: "asc" }],
      });
      for (const { orden } of enlaces) {
        exigirEnlaceCoherente(orden, { ...datos, reemplazada: false });
        await escribirEnlace(tx, { ordenId: orden.id, decisionId: nueva.id, autorId: d.autorId, motivo: `correccion:${anterior.id}` });
      }
      return { ...nueva, enlacesMovidos: enlaces.length };
    });
  } catch (error) {
    throw traducirChoque(error, CHOQUES_CORRECCION);
  }
}

