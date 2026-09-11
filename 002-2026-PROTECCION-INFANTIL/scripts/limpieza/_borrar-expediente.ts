import type { Prisma } from "@prisma/client";

/**
 * SPEC-615 (I-374) — Borra el subárbol FK-safe de un conjunto de expedientes y LUEGO los expedientes.
 *
 * ÚNICA fuente del orden. Antes `borrar-padre` y `borrar-colegio` tenían cada una su COPIA del
 * subárbol; ambas olvidaron `InformePadre` (FK RESTRICT → Expediente, sin `onDelete`), y la purga
 * abortó en `expediente.deleteMany`. Con dos copias, cada FK nueva se descubre en producción, una
 * por incidente. Acá vive una sola vez.
 *
 * `HIJAS_RESTRICT_EXPEDIENTE` es el ORIGEN ÚNICO, y los candados lo ATAN por las dos puntas —no basta
 * con que una entrada exista en la lista, la DELETE real tiene que pasar:
 *  - `purga-subarbol` (ensayo contra BD real) ITERA la constante: siembra una fila por entrada y afirma
 *    POR ENTRADA que quedó en 0. Si este helper olvida un `deleteMany` de una hija listada, la FK
 *    RESTRICT tumba `expediente.deleteMany` y el candado se pone rojo nombrando la constraint.
 *  - `purga-fk-cobertura` DERIVA de `pg_constraint` las hijas RESTRICT/NO-ACTION hacia Expediente y
 *    exige que sean EXACTAMENTE las de la constante: si el catálogo gana una hija nueva (o la constante
 *    queda con una que ya no existe), rojo — así la cuarta rotura muere en CI, no en la próxima ventana.
 *
 * FKs RESTRICT hacia Expediente (pg_constraint, verificado): EventoExpediente · InformePadre ·
 * aclaracion_expediente · informes_consolidados · patrones_expediente. Más la auto-relación
 * (`expedienteRelacionadoAnteriorId`), que se nulea antes.
 */

/** Modelos hija con FK RESTRICT hacia Expediente — ORIGEN ÚNICO que ATAN los dos candados (arriba). */
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
