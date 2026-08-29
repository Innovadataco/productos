/**
 * SPEC-305 (A-50): repositorio de datos para el semáforo del círculo de confianza.
 * Frontera DAL (Q-3): todo acceso a Prisma para el semáforo pasa por aquí.
 */
import { prisma } from "@/lib/prisma";
import { whereReportesCirculo } from "@/lib/dal/services/circulo-confianza/estado";
import type { DatosReporte } from "@/lib/dal/services/circulo-confianza/tipos";

export interface SemaforoRawContacto {
    id: string;
    etiqueta: string | null;
    activo: boolean;
    valores: string[];
}

export class SemaforoRepository {
    async listarContactosConIdentificadores(usuarioId: string): Promise<SemaforoRawContacto[]> {
        const contactos = await prisma.contactoConfianza.findMany({
            where: { usuarioId },
            include: {
                identificadores: {
                    where: { activo: true },
                    select: { valor: true },
                },
            },
            orderBy: [{ activo: "desc" }, { creadoEn: "desc" }],
        });

        return contactos.map((contacto) => ({
            id: contacto.id,
            etiqueta: contacto.etiqueta,
            activo: contacto.activo,
            valores: contacto.identificadores.map((i) => i.valor),
        }));
    }

    async buscarReportesVisiblesPorIdentificadores(identificadores: string[]): Promise<DatosReporte[]> {
        if (identificadores.length === 0) return [];
        return prisma.reporte.findMany({
            where: whereReportesCirculo({ identificador: { in: identificadores } }),
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

    async buscarExpedientesAbiertosPorIdentificadores(
        usuarioId: string,
        identificadores: string[]
    ): Promise<{ identificadorReportado: string; scoreGravedadActual: string }[]> {
        if (identificadores.length === 0) return [];
        return prisma.expediente.findMany({
            where: {
                padreUsuarioId: usuarioId,
                identificadorReportado: { in: identificadores },
                estado: { not: "CERRADO" },
            },
            select: { identificadorReportado: true, scoreGravedadActual: true },
        });
    }
}
