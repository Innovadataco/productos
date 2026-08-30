/**
 * SPEC-306 (A-50): repositorio de datos para el timeline de eventos del círculo
 * de confianza. Frontera DAL (Q-3).
 */
import { prisma } from "@/lib/prisma";
import { whereReportesCirculo } from "@/lib/dal/services/circulo-confianza/estado";
import type { DatosReporte } from "@/lib/dal/services/circulo-confianza/tipos";

export interface TimelineRawContacto {
    id: string;
    etiqueta: string | null;
    valores: string[];
}

export interface EventoExpedienteTimeline {
    id: string;
    expedienteId: string;
    fechaEvento: Date;
    texto: string;
    categoriaDetectada: string | null;
    ordenSecuencial: number;
}

export interface ExpedienteTimeline {
    id: string;
    identificadorReportado: string;
    scoreGravedadActual: string;
}

export class TimelineCirculoRepository {
    async listarContactosConIdentificadores(usuarioId: string): Promise<TimelineRawContacto[]> {
        const contactos = await prisma.contactoConfianza.findMany({
            where: { usuarioId, activo: true },
            include: {
                identificadores: {
                    where: { activo: true },
                    select: { valor: true },
                },
            },
            orderBy: { creadoEn: "desc" },
        });

        return contactos.map((contacto) => ({
            id: contacto.id,
            etiqueta: contacto.etiqueta,
            valores: contacto.identificadores.map((i) => i.valor),
        }));
    }

    async buscarReportesVisiblesRecientes(identificadores: string[], desde: Date): Promise<DatosReporte[]> {
        if (identificadores.length === 0) return [];
        return prisma.reporte.findMany({
            where: whereReportesCirculo({
                identificador: { in: identificadores },
                creadoEn: { gte: desde },
            }),
            select: {
                id: true,
                identificador: true,
                ciudad: true,
                pais: true,
                creadoEn: true,
                fechaIncidente: true,
                esAnonimo: true,
                estado: true,
                plataforma: { select: { id: true, nombre: true, clave: true } },
                clasificacion: { select: { categoria: true, confianza: true } },
                ciudadRel: { select: { lat: true, lng: true } },
            },
            orderBy: { creadoEn: "desc" },
        }) as Promise<DatosReporte[]>;
    }

    async buscarEventosExpedienteRecientes(
        usuarioId: string,
        identificadores: string[],
        desde: Date
    ): Promise<EventoExpedienteTimeline[]> {
        if (identificadores.length === 0) return [];
        return prisma.eventoExpediente.findMany({
            where: {
                expediente: {
                    padreUsuarioId: usuarioId,
                    identificadorReportado: { in: identificadores },
                },
                fechaEvento: { gte: desde },
            },
            select: {
                id: true,
                expedienteId: true,
                fechaEvento: true,
                texto: true,
                categoriaDetectada: true,
                ordenSecuencial: true,
            },
            orderBy: { fechaEvento: "desc" },
        });
    }

    async buscarExpedientesPorIdentificadores(
        usuarioId: string,
        identificadores: string[]
    ): Promise<ExpedienteTimeline[]> {
        if (identificadores.length === 0) return [];
        return prisma.expediente.findMany({
            where: {
                padreUsuarioId: usuarioId,
                identificadorReportado: { in: identificadores },
            },
            select: {
                id: true,
                identificadorReportado: true,
                scoreGravedadActual: true,
            },
        });
    }
}
