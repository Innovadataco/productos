/**
 * Versiones del plan: cada una es la foto completa del plan en una fecha, con sus reglas. Nunca se
 * edita (disparador de solo inserción): un cambio es una versión nueva con su fecha y su motivo, y la
 * anterior queda en la historia. La vigencia no retrocede, así que la versión vigente en una fecha es
 * la de mayor número con `vigenteDesde` ≤ esa fecha.
 */
import type { PlanVersion, PrismaClient } from "@prisma/client";
import { fechaEnBogota } from "../precios/horario";
import { exigirDueno, type Db } from "./acceso";
import { bloquearVersiones } from "./bloqueos";
import { ErrorPlan, exigirSinErrores } from "./errores";
import { validarVersionPlan, type DatosVersionValidable } from "./validar";

/** `hoy` se puede fijar (pruebas); por defecto, la fecha de hoy en Colombia. */
export interface OpcionesPlan {
  readonly hoy?: Date;
}

export const hoyDe = (o: OpcionesPlan): Date => o.hoy ?? fechaEnBogota(new Date());

export interface DatosVersionPlan extends DatosVersionValidable {
  readonly autorId: string;
}

export interface VersionCreada {
  readonly id: string;
  readonly version: number;
  /** En el mismo orden de `reglas`. */
  readonly reglaIds: readonly string[];
}

export async function versionVigente(db: Db, fecha: Date): Promise<PlanVersion | null> {
  return db.planVersion.findFirst({ where: { vigenteDesde: { lte: fecha } }, orderBy: { version: "desc" } });
}

async function exigirInstrumentos(db: Db, ids: readonly string[]): Promise<void> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return;
  const existentes = await db.instrumento.count({ where: { id: { in: unicos } } });
  if (existentes !== unicos.length) throw new ErrorPlan("INSTRUMENTO_INEXISTENTE");
}

export async function crearVersionPlan(db: PrismaClient, d: DatosVersionPlan, opciones: OpcionesPlan = {}): Promise<VersionCreada> {
  exigirSinErrores(validarVersionPlan(d, hoyDe(opciones)));
  await exigirDueno(db, d.autorId);
  return db.$transaction(async (tx) => {
    // Exclusivo: serializa la numeración y deja esperando a las decisiones (que toman el compartido).
    await bloquearVersiones(tx, "exclusivo");
    const ultima = await tx.planVersion.findFirst({ orderBy: { version: "desc" }, select: { version: true, vigenteDesde: true } });
    if (ultima && d.vigenteDesde < ultima.vigenteDesde) throw new ErrorPlan("VIGENCIA_RETROCEDE");
    await exigirInstrumentos(tx, d.reglas.flatMap((r) => (r.instrumentoId === null ? [] : [r.instrumentoId])));
    const version = await tx.planVersion.create({
      data: { version: (ultima?.version ?? 0) + 1, vigenteDesde: d.vigenteDesde, motivo: d.motivo.trim(), aprobadaPorId: d.autorId },
    });
    const reglas = await Promise.all(
      d.reglas.map((r) =>
        tx.reglaPlan.create({
          data: {
            planVersionId: version.id,
            instrumentoId: r.instrumentoId,
            condicion: r.condicion,
            nivel: r.nivel,
            accion: r.accion,
            cantidad: r.cantidad,
            plazoHasta: r.plazoHasta,
            detalle: r.detalle.trim(),
          },
          select: { id: true },
        }),
      ),
    );
    return { id: version.id, version: version.version, reglaIds: reglas.map((r) => r.id) };
  });
}
