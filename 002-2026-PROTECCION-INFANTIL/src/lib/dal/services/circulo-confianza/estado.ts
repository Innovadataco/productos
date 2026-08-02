/**
 * SPEC-135 (E-2): estado derivado de reportes del círculo (predicado único spec
 * 093-US1) y parámetros del círculo. Movimiento mecánico desde el god-module.
 */
import { whereReporteAprobado } from "@/lib/reporte-aprobado";
import { getParametroSistemaValor } from "@/lib/parametros";
import type { EstadoReporte, Prisma } from "@prisma/client";
import type { DatosReporte, EstadoContacto } from "./tipos";
import { ESTADOS_REVISION, getClient } from "./tipos";

// Spec 093-US1: el círculo cuenta (a) reportes APROBADOS (predicado único: sin SPAM/OTRO)
// y (b) reportes en revisión humana ("En proceso"). POSIBLE_SPAM y DUPLICADO no cuentan.
export function whereReportesCirculo(extra: Prisma.ReporteWhereInput = {}): Prisma.ReporteWhereInput {
    return {
        ...extra,
        eliminado: false,
        OR: [
            whereReporteAprobado(),
            { estado: { in: ["REVISION_MANUAL", "REQUIERE_ANONIMIZACION"] } },
        ],
    };
}

export function calcularEstado(reportes: DatosReporte[]): EstadoContacto {
    if (reportes.length === 0) return "sinReportes";
    const tieneRevision = reportes.some((r) => ESTADOS_REVISION.includes(r.estado as EstadoReporte));
    if (tieneRevision) return "enRevision";
    return "clasificado";
}

export async function contarContactosActivos(
    usuarioId: string,
    client?: Prisma.TransactionClient
): Promise<number> {
    return getClient(client).contactoConfianza.count({
        where: { usuarioId, activo: true },
    });
}

export async function obtenerTopeContactos(client?: Prisma.TransactionClient): Promise<number> {
    const valor = await getParametroSistemaValor("circulo.max_contactos", client);
    const parsed = parseInt(valor || "20", 10);
    return Number.isNaN(parsed) ? 20 : parsed;
}

export async function obtenerUmbralAgregacion(client?: Prisma.TransactionClient): Promise<{
    contactosConReportes: number;
    totalReportes: number;
}> {
    const valor = await getParametroSistemaValor("circulo.umbral_agregacion", client);
    try {
        const parsed = JSON.parse(valor || '{"contactosConReportes":2,"totalReportes":3}');
        return {
            contactosConReportes: Math.max(1, parseInt(parsed.contactosConReportes, 10) || 2),
            totalReportes: Math.max(1, parseInt(parsed.totalReportes, 10) || 3),
        };
    } catch {
        return { contactosConReportes: 2, totalReportes: 3 };
    }
}

export async function determinarEstadoContacto(
    contactoId: string,
    client?: Prisma.TransactionClient
): Promise<{ estado: EstadoContacto; totalReportes: number; reportes: DatosReporte[] }> {
    const c = getClient(client);

    const identificadores = await c.identificadorContacto.findMany({
        where: { contactoId, activo: true },
        select: { valor: true },
    });

    const valores = identificadores.map((i) => i.valor);

    if (valores.length === 0) {
        return { estado: "sinReportes", totalReportes: 0, reportes: [] };
    }

    const reportes = (await c.reporte.findMany({
        where: whereReportesCirculo({ identificador: { in: valores } }),
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
    })) as DatosReporte[];

    return { estado: calcularEstado(reportes), totalReportes: reportes.length, reportes };
}
