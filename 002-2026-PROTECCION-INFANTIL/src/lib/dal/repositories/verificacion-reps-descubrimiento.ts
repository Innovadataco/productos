/**
 * SPEC-801 · La consulta de DESCUBRIMIENTO del REPS (capa DAL).
 *
 * Responde la pregunta que el radicado puso como ENTREGABLE (no el campo):
 *   «¿Qué modalidades llegaron del REPS que NO sabemos traducir, y a cuántos profesionales afectaron?»
 *
 * Una columna que nadie consulta es el MISMO silencio que un `warn`. Por eso el entregable es esta
 * consulta: agrupa por el valor CRUDO (unnest de `VerificacionReps.modalidadesNoMapeadas`) y cuenta
 * profesionales DISTINTOS (no filas — un mismo profesional con dos chequeos de la misma modalidad
 * cuenta UNA vez). Sin filas con modalidades sin mapear devuelve `[]` (vacío, NO error): una consulta
 * de descubrimiento que explota cuando no hay nada que descubrir es inútil justo el 99% del tiempo.
 *
 * Vive en el DAL (acceso directo a Prisma permitido acá, Q-3). Nombre específico `-descubrimiento` para
 * no chocar con un futuro repositorio general de VerificacionReps (carril del motor de Dev-1).
 *
 * Lo que esta consulta NO hace (fuera de alcance, SPEC-801):
 *  · NO reemplaza el `warn` de runtime del mapeo (`modalidad-cita-a-reps.ts`): el log sirve en el
 *    momento, esto sirve para descubrir después — son dos cosas y ninguna cubre a la otra.
 *  · NO abre la compuerta: una modalidad sin mapear SIGUE negando (fail-closed). Esto la hace AUDITABLE.
 *  · NO decide qué se hace con un profesional afectado — eso es decisión, y vendrá cuando haya datos.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface ModalidadRepsNoMapeada {
    /** El valor crudo tal como llegó del REPS, sin traducir a `ModalidadReps`. */
    modalidad: string;
    /** Profesionales DISTINTOS con al menos una verificación que trajo esta modalidad sin mapear. */
    profesionalesAfectados: number;
}

/**
 * Devuelve, por cada modalidad cruda sin mapear, cuántos profesionales distintos afectó.
 * Ordenado por impacto (más profesionales primero), luego alfabético. `[]` si no hay ninguna.
 */
export async function modalidadesRepsNoMapeadas(
    db: Pick<PrismaClient, "$queryRaw"> = prisma,
): Promise<ModalidadRepsNoMapeada[]> {
    const filas = await db.$queryRaw<Array<{ modalidad: string; profesionalesAfectados: bigint }>>`
        SELECT m AS modalidad, COUNT(DISTINCT "profesionalId") AS "profesionalesAfectados"
        FROM "VerificacionReps", unnest("modalidadesNoMapeadas") AS m
        GROUP BY m
        ORDER BY COUNT(DISTINCT "profesionalId") DESC, m ASC
    `;
    return filas.map((f) => ({
        modalidad: f.modalidad,
        profesionalesAfectados: Number(f.profesionalesAfectados),
    }));
}
