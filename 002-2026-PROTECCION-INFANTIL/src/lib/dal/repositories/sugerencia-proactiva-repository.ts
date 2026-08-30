/**
 * SPEC-307 (A-50): repositorio de datos para la sugerencia proactiva del padre.
 * Frontera DAL (Q-3): centraliza las queries de expedientes y notificaciones
 * relevantes para la sugerencia.
 */
import { prisma } from "@/lib/prisma";

export interface ExpedienteSugerencia {
    id: string;
    identificadorReportado: string;
    scoreGravedadActual: string;
    estado: string;
    createdAt: Date;
    updatedAt: Date;
}

export class SugerenciaProactivaRepository {
    async contarContactosActivos(usuarioId: string): Promise<number> {
        return prisma.contactoConfianza.count({
            where: { usuarioId, activo: true },
        });
    }

    async buscarExpedientesDelPadre(usuarioId: string): Promise<ExpedienteSugerencia[]> {
        return prisma.expediente.findMany({
            where: { padreUsuarioId: usuarioId },
            select: {
                id: true,
                identificadorReportado: true,
                scoreGravedadActual: true,
                estado: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
}
