/**
 * SPEC-236 (002-PI-mega-cola): consulta de aclaraciones del expediente para
 * los guards de la máquina de estados.
 *
 * HALLAZGO/DEPENDENCIA: la tabla `AclaracionExpediente` la define SPEC-238 y
 * aún no existe en `prisma/schema.prisma` al implementar esta spec. Hasta que
 * SPEC-238 aterrice el modelo, esta consulta devuelve 0 (no hay aclaraciones),
 * por lo que los guards EN_APROBACION_PADRE ↔ EN_ACLARACION y el cierre
 * forzado por aclaración respondida fallan de forma segura (409) en vez de
 * permitir transiciones sin evidencia.
 *
 * Al existir el modelo, reemplazar el cuerpo por la consulta Prisma real:
 *   prisma.aclaracionExpediente.count({ where: { expedienteId, estado } })
 */

export type EstadoAclaracionConsulta = "PENDIENTE" | "RESPONDIDA" | "CERRADA_FORZOSAMENTE";

export async function contarAclaracionesPorEstado(
    expedienteId: string,
    estado: EstadoAclaracionConsulta
): Promise<number> {
    // TODO(SPEC-238): reemplazar por consulta real a AclaracionExpediente.
    void expedienteId;
    void estado;
    return 0;
}
