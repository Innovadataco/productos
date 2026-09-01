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
    // SPEC-340: puede no existir aún — el expediente nace por el botón.
    expedienteId: string | null;
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

    // SPEC-340: el timeline se alimenta de la CADENA de reportes PROPIOS del
    // padre (reportePrincipalId), no del expediente — el expediente ahora nace
    // por el botón y no puede ser la fuente de una señal viva. Mismo blindaje
    // de siempre: SOLO reportes propios (usuarioId), jamás texto/autor ajeno.
    const reportes = await c.reporte.findMany({
        where: {
            usuarioId,
            eliminado: false,
            identificador: { in: Array.from(valores) },
        },
        orderBy: { fechaIncidente: "desc" },
        take: limite,
        select: {
            id: true,
            fechaIncidente: true,
            identificador: true,
            reportePrincipalId: true,
            clasificacion: { select: { categoria: true } },
        },
    });

    if (reportes.length === 0) return [];

    // El expediente, si existe, se enlaza como vista (puede no existir aún).
    const expedientes = await c.expediente.findMany({
        where: {
            padreUsuarioId: usuarioId,
            identificadorReportado: { in: Array.from(valores) },
        },
        select: { id: true, identificadorReportado: true },
    });
    const expedientePorIdentificador = new Map(expedientes.map((e) => [e.identificadorReportado, e.id]));

    return reportes.map((r) => ({
        id: r.id,
        fechaEvento: r.fechaIncidente,
        // El texto NO viaja al home (SPEC-340 §3.3-bis: solo por la vía con
        // step-up). El timeline muestra fecha, categoría y a quién refiere.
        texto: "",
        categoria: r.clasificacion?.categoria ?? null,
        contactoEtiqueta: valoresPorEtiqueta.get(r.identificador) ?? null,
        expedienteId: expedientePorIdentificador.get(r.identificador) ?? null,
    }));
}
