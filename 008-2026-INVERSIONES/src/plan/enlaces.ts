/**
 * Enlace de una orden importada de Trii a la decisión que la originó. Nada se sobrescribe: cambiar el
 * enlace crea uno nuevo que reemplaza al vigente (con motivo), y el anterior queda en la historia.
 * La base garantiza la cadena lineal (un solo enlace raíz por orden y una sola corrección por enlace).
 */
import type { PrismaClient } from "@prisma/client";
import { exigirDueno, type Db } from "./acceso";
import { bloquearDecision } from "./bloqueos";
import { ErrorPlan, exigirSinErrores, traducirChoque } from "./errores";
import { validarEnlace, validarMotivoEnlace, type DecisionEnlazable, type OrdenEnlazable } from "./validar";

export interface DatosEnlace {
  readonly ordenId: string;
  readonly decisionId: string;
  readonly autorId: string;
  /** Opcional en el primer enlace; obligatorio para cambiar uno vigente. */
  readonly motivo?: string | null;
}

export interface EnlaceCreado {
  readonly id: string;
  readonly reemplazaId: string | null;
}

/** Choques de unicidad por dos escrituras a la vez sobre la misma orden o el mismo enlace. */
export const CHOQUES_ENLACE: Readonly<Record<string, string>> = { reemplazaId: "ENLACE_YA_REEMPLAZADO", raiz: "ORDEN_YA_ENLAZADA", ordenId: "ORDEN_YA_ENLAZADA" };

export async function enlaceVigente(db: Db, ordenId: string): Promise<{ id: string; decisionId: string } | null> {
  return db.enlaceDecisionOrden.findFirst({ where: { ordenId, reemplazadoPor: { is: null } }, select: { id: true, decisionId: true } });
}

/** Escribe el enlace (raíz o corrección) sin volver a validar la coherencia: la valida quien llama. */
export async function escribirEnlace(db: Db, d: { readonly ordenId: string; readonly decisionId: string; readonly autorId: string; readonly motivo: string | null }): Promise<EnlaceCreado> {
  const vigente = await enlaceVigente(db, d.ordenId);
  if (vigente?.decisionId === d.decisionId) throw new ErrorPlan("YA_ENLAZADA_A_ESA_DECISION");
  if (vigente && d.motivo === null) throw new ErrorPlan("ORDEN_YA_ENLAZADA");
  const creado = await db.enlaceDecisionOrden.create({
    data: { ordenId: d.ordenId, decisionId: d.decisionId, reemplazaId: vigente?.id ?? null, motivo: d.motivo, creadoPorId: d.autorId },
    select: { id: true, reemplazaId: true },
  });
  return creado;
}

export function exigirEnlaceCoherente(orden: OrdenEnlazable, decision: DecisionEnlazable): void {
  const errores = validarEnlace(orden, decision);
  if (errores[0]) throw new ErrorPlan(errores[0].codigo, errores);
}

export async function enlazarOrden(db: PrismaClient, d: DatosEnlace): Promise<EnlaceCreado> {
  exigirSinErrores(validarMotivoEnlace(d.motivo));
  await exigirDueno(db, d.autorId);
  const motivo = d.motivo?.trim() ? d.motivo.trim() : null;
  try {
    return await db.$transaction(async (tx) => {
      const orden = await tx.orden.findUnique({ where: { id: d.ordenId }, select: { estado: true, instrumentoId: true, lado: true, fechaOperacion: true } });
      if (!orden) throw new ErrorPlan("ORDEN_INEXISTENTE");
      // Bloquear y DESPUÉS leer: si una corrección iba en curso, aquí ya se ve como reemplazada.
      if (!(await bloquearDecision(tx, d.decisionId))) throw new ErrorPlan("DECISION_INEXISTENTE");
      const decision = await tx.decision.findUnique({
        where: { id: d.decisionId },
        select: { accion: true, instrumentoId: true, fechaDecision: true, reemplazadaPor: { select: { id: true } } },
      });
      if (!decision) throw new ErrorPlan("DECISION_INEXISTENTE");
      exigirEnlaceCoherente(orden, { ...decision, reemplazada: decision.reemplazadaPor !== null });
      return escribirEnlace(tx, { ordenId: d.ordenId, decisionId: d.decisionId, autorId: d.autorId, motivo });
    });
  } catch (error) {
    throw traducirChoque(error, CHOQUES_ENLACE);
  }
}
