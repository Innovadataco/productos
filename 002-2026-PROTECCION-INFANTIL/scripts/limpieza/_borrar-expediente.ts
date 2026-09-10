import type { Prisma } from "@prisma/client";

/**
 * SPEC-615 (I-374) — Borra el subárbol FK-safe de un conjunto de expedientes y LUEGO los expedientes.
 *
 * ÚNICA fuente del orden. Antes `borrar-padre` y `borrar-colegio` tenían cada una su COPIA del
 * subárbol; ambas olvidaron `InformePadre` (FK RESTRICT → Expediente, sin `onDelete`), y la purga
 * abortó en `expediente.deleteMany`. Con dos copias, cada FK nueva se descubre en producción, una
 * por incidente. Acá vive una sola vez; el candado `purga-fk-cobertura` deriva del catálogo
 * (`pg_constraint`) TODAS las FKs RESTRICT hacia Expediente y se pone rojo si aparece una que este
 * helper no borra — así la cuarta rotura muere en CI, no en la próxima ventana.
 *
 * FKs RESTRICT hacia Expediente (pg_constraint, verificado): EventoExpediente · InformePadre ·
 * aclaracion_expediente · informes_consolidados · patrones_expediente. Más la auto-relación
 * (`expedienteRelacionadoAnteriorId`), que se nulea antes.
 */

/** Modelos hija con FK RESTRICT hacia Expediente que este helper borra. Lo consume el candado. */
export const HIJAS_RESTRICT_EXPEDIENTE = [
    "InformePadre",
    "AclaracionExpediente",
    "InformeConsolidado",
    "PatronExpediente",
    "EventoExpediente",
] as const;

export async function borrarSubarbolExpediente(
    tx: Prisma.TransactionClient,
    expedienteIds: string[],
): Promise<void> {
    if (expedienteIds.length === 0) return;
    const where = { expedienteId: { in: expedienteIds } };
    // Auto-relación primero: un expediente puede referenciar a otro anterior.
    await tx.expediente.updateMany({
        where: { id: { in: expedienteIds } },
        data: { expedienteRelacionadoAnteriorId: null },
    });
    // TODAS las hijas RESTRICT antes del Expediente. InformePadre era la que faltaba (I-374).
    await tx.informePadre.deleteMany({ where });
    await tx.aclaracionExpediente.deleteMany({ where });
    await tx.informeConsolidado.deleteMany({ where });
    await tx.patronExpediente.deleteMany({ where });
    await tx.eventoExpediente.deleteMany({ where });
    // Y por fin los expedientes.
    await tx.expediente.deleteMany({ where: { id: { in: expedienteIds } } });
}
