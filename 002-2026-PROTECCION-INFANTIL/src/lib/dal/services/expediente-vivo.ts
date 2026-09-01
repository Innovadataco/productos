/**
 * SPEC-340 (A-68 §4.1) — los hechos del expediente vivo: mapa + línea de tiempo.
 *
 * TODOS los reportes del identificador de la cadena: los PROPIOS del padre
 * (completos — el texto va tapado y se pide por la vía con step-up) y los
 * AJENOS blindados (fecha/lugar/clasificación, jamás texto ni autor), cada uno
 * marcado mío / otro padre / anónimo. Solo ciudades, nunca direcciones.
 */
import { prisma } from "../../prisma";
import { formatCategoria } from "../../labels";
import { whereReporteAprobado } from "../../reportes-acceso";

export interface HechoVivo {
    /** Solo para los propios (el texto se pide por reporteId); null en ajenos. */
    reporteId: string | null;
    fecha: Date;
    ciudad: string | null;
    pais: string | null;
    lat: number | null;
    lng: number | null;
    categoriaLabel: string | null;
    origen: "mio" | "otro_padre" | "anonimo";
}

export async function hechosDelExpediente(expedienteId: string, usuarioId: string) {
    const expediente = await prisma.expediente.findFirst({
        where: { id: expedienteId, padreUsuarioId: usuarioId },
        select: { id: true, identificadorReportado: true, fechaApertura: true, origenCreacion: true },
    });
    if (!expediente) return null;

    const [propios, ajenos, informes] = await Promise.all([
        prisma.reporte.findMany({
            where: { usuarioId, eliminado: false, identificador: expediente.identificadorReportado },
            select: {
                id: true,
                fechaIncidente: true,
                ciudad: true,
                pais: true,
                ciudadRel: { select: { nombre: true, lat: true, lng: true } },
                clasificacion: { select: { categoria: true } },
            },
            orderBy: { fechaIncidente: "asc" },
        }),
        prisma.reporte.findMany({
            where: whereReporteAprobado({
                identificador: expediente.identificadorReportado,
                NOT: { usuarioId },
            }),
            select: {
                fechaIncidente: true,
                ciudad: true,
                pais: true,
                esAnonimo: true,
                ciudadRel: { select: { nombre: true, lat: true, lng: true } },
                clasificacion: { select: { categoria: true } },
            },
            orderBy: { fechaIncidente: "asc" },
        }),
        prisma.informePadre.findMany({
            where: { expedienteId },
            orderBy: { numeroSecuencial: "desc" },
            select: { numeroSecuencial: true, generadoEn: true, codigoVerificacion: true },
        }),
    ]);

    const hechos: HechoVivo[] = [
        ...propios.map((r) => ({
            reporteId: r.id,
            fecha: r.fechaIncidente,
            ciudad: r.ciudadRel?.nombre ?? r.ciudad,
            pais: r.pais,
            lat: r.ciudadRel?.lat ?? null,
            lng: r.ciudadRel?.lng ?? null,
            categoriaLabel: r.clasificacion ? formatCategoria(r.clasificacion.categoria) : null,
            origen: "mio" as const,
        })),
        ...ajenos.map((r) => ({
            reporteId: null,
            fecha: r.fechaIncidente,
            ciudad: r.ciudadRel?.nombre ?? r.ciudad,
            pais: r.pais,
            lat: r.ciudadRel?.lat ?? null,
            lng: r.ciudadRel?.lng ?? null,
            categoriaLabel: r.clasificacion ? formatCategoria(r.clasificacion.categoria) : null,
            origen: r.esAnonimo ? ("anonimo" as const) : ("otro_padre" as const),
        })),
    ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    return { expediente, hechos, informes };
}
