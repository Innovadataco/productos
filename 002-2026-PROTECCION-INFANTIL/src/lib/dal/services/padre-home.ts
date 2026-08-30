/**
 * SPEC-309 (A-50): capa DAL del home proactivo del padre.
 * Centraliza las consultas a Prisma para que src/lib/padre/ no acceda
 * directamente a @/lib/prisma (Q-3).
 */
import { prisma } from "@/lib/prisma";
import type { EstadoReporte, Prisma } from "@prisma/client";

export type ContactoHomeDAL = {
    id: string;
    etiqueta: string | null;
    identificadores: { valor: string }[];
};

export type ReporteHomeDAL = {
    identificador: string;
    estado: string;
    creadoEn: Date;
};

export type EventoTimelineDAL = {
    id: string;
    fechaEvento: Date;
    texto: string;
    categoria: string | null;
    contactoEtiqueta: string | null;
    expedienteId: string;
};

const ESTADOS_CLASIFICADOS: EstadoReporte[] = ["CLASIFICADO", "CORREGIDO"];
const ESTADOS_REVISION: EstadoReporte[] = ["REVISION_MANUAL", "REQUIERE_ANONIMIZACION"];
const ESTADOS_VISIBLES: EstadoReporte[] = [...ESTADOS_CLASIFICADOS, ...ESTADOS_REVISION];

function getClient(client?: Prisma.TransactionClient) {
    return client || prisma;
}

export async function obtenerContactosActivos(usuarioId: string, client?: Prisma.TransactionClient): Promise<ContactoHomeDAL[]> {
    const c = getClient(client);
    return c.contactoConfianza.findMany({
        where: { usuarioId, activo: true },
        select: {
            id: true,
            etiqueta: true,
            identificadores: {
                where: { activo: true },
                select: { valor: true },
            },
        },
    });
}

export async function obtenerReportesVisiblesPorIdentificadores(
    valores: string[],
    client?: Prisma.TransactionClient
): Promise<ReporteHomeDAL[]> {
    const c = getClient(client);
    if (valores.length === 0) return [];
    return c.reporte.findMany({
        where: {
            identificador: { in: valores },
            eliminado: false,
            estado: { in: ESTADOS_VISIBLES },
        },
        select: { identificador: true, estado: true, creadoEn: true },
    });
}

export async function obtenerResumenReportesPorIdentificadores(
    valores: string[],
    client?: Prisma.TransactionClient
): Promise<{ identificador: string; estado: string }[]> {
    const c = getClient(client);
    if (valores.length === 0) return [];
    return c.reporte.findMany({
        where: {
            identificador: { in: valores },
            eliminado: false,
            estado: { in: ESTADOS_VISIBLES },
        },
        select: { identificador: true, estado: true },
    });
}

export async function obtenerEventosTimeline(
    usuarioId: string,
    limite = 5,
    client?: Prisma.TransactionClient
): Promise<EventoTimelineDAL[]> {
    const c = getClient(client);

    const contactos = await c.contactoConfianza.findMany({
        where: { usuarioId, activo: true },
        select: {
            etiqueta: true,
            identificadores: {
                where: { activo: true },
                select: { valor: true },
            },
        },
    });

    if (contactos.length === 0) return [];

    const valoresPorEtiqueta = new Map<string, string | null>();
    const valores = new Set<string>();
    for (const contacto of contactos) {
        for (const i of contacto.identificadores) {
            valores.add(i.valor);
            if (!valoresPorEtiqueta.has(i.valor)) {
                valoresPorEtiqueta.set(i.valor, contacto.etiqueta);
            }
        }
    }

    const expedientes = await c.expediente.findMany({
        where: {
            padreUsuarioId: usuarioId,
            identificadorReportado: { in: Array.from(valores) },
        },
        select: { id: true, identificadorReportado: true },
    });

    if (expedientes.length === 0) return [];

    const expedienteIds = expedientes.map((e) => e.id);
    const identificadorPorExpediente = new Map(expedientes.map((e) => [e.id, e.identificadorReportado]));

    const eventos = await c.eventoExpediente.findMany({
        where: { expedienteId: { in: expedienteIds } },
        orderBy: { fechaEvento: "desc" },
        take: limite,
        select: {
            id: true,
            fechaEvento: true,
            texto: true,
            categoriaDetectada: true,
            expedienteId: true,
        },
    });

    return eventos.map((e) => {
        const identificador = identificadorPorExpediente.get(e.expedienteId);
        return {
            id: e.id,
            fechaEvento: e.fechaEvento,
            texto: e.texto,
            categoria: e.categoriaDetectada,
            contactoEtiqueta: identificador ? valoresPorEtiqueta.get(identificador) ?? null : null,
            expedienteId: e.expedienteId,
        };
    });
}
