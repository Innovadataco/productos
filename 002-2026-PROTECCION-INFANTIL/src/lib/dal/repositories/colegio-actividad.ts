import type { EstadoReporte, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const SELECT_REPORTE = {
    id: true,
    estado: true,
    creadoEn: true,
} satisfies Prisma.ReporteSelect;

export type ReporteResumen = Prisma.ReporteGetPayload<{ select: typeof SELECT_REPORTE }>;

export interface RangoActividad {
    desde: Date;
    hasta: Date;
}

export interface ActividadDelColegio {
    reportes: ReporteResumen[];
    total: number;
    porEstado: Partial<Record<EstadoReporte, number>>;
    casosAbiertos: number;
    ultimaActividad: Date | null;
}

const ALERTA_ESTADOS_ABIERTOS = ["nueva", "vista", "escalada"] as const;

/**
 * SPEC-303 (002-PI-209) · fuente única de "reportes que pertenecen al colegio".
 * Cruza 3 rutas de pertenencia con UNIÓN sin duplicados por Reporte.id:
 *  A) Reporte.tenantId == Colegio.tenantId (autor asociado por tenantId denormalizado)
 *  B) (identificador, plataformaId) matchea un identificador enrolado en el colegio
 *     (IdentificadorEstudiante+Estudiante · IdentificadorProfesor · IdentificadorAcudiente)
 *  C) Reporte.id referenciado por AlertaColegio del colegio
 *
 * Nota T002/D5: `Expediente` no tiene `colegioId` directo; en Fase 1
 * `casosAbiertos` cuenta SOLO alertas abiertas (nueva|vista|escalada).
 * Expedientes se incorporan en Fase 2 (SPEC-304).
 */
export class ColegioActividadRepository {
    private readonly db: DbClient;

    constructor(tx?: DbClient) {
        this.db = tx ?? prisma;
    }

    async actividadDelColegio(
        colegioId: string,
        rango: RangoActividad
    ): Promise<ActividadDelColegio> {
        if (rango.desde > rango.hasta) {
            throw new Error(
                `Rango inválido en actividadDelColegio: desde ${rango.desde.toISOString()} > hasta ${rango.hasta.toISOString()}`
            );
        }

        const colegio = await this.db.colegio.findUnique({
            where: { id: colegioId },
            select: { tenantId: true },
        });
        if (!colegio) {
            throw new Error(`Colegio no encontrado: ${colegioId}`);
        }

        const rangoWhere: Prisma.ReporteWhereInput = {
            creadoEn: { gte: rango.desde, lte: rango.hasta },
        };

        const identificadoresEnrolados = await this.recolectarIdentificadoresEnrolados(colegioId);
        const reporteIdsPorAlerta = await this.recolectarReporteIdsPorAlerta(colegioId);

        const [porTenant, porIdentificador, porAlerta] = await Promise.all([
            colegio.tenantId
                ? this.db.reporte.findMany({
                    where: { ...rangoWhere, tenantId: colegio.tenantId },
                    select: SELECT_REPORTE,
                })
                : Promise.resolve<ReporteResumen[]>([]),
            identificadoresEnrolados.length > 0
                ? this.db.reporte.findMany({
                    where: {
                        ...rangoWhere,
                        OR: identificadoresEnrolados.map((par) => ({
                            identificador: par.valor,
                            plataformaId: par.plataformaId,
                        })),
                    },
                    select: SELECT_REPORTE,
                })
                : Promise.resolve<ReporteResumen[]>([]),
            reporteIdsPorAlerta.length > 0
                ? this.db.reporte.findMany({
                    where: { ...rangoWhere, id: { in: reporteIdsPorAlerta } },
                    select: SELECT_REPORTE,
                })
                : Promise.resolve<ReporteResumen[]>([]),
        ]);

        const dedup = new Map<string, ReporteResumen>();
        for (const r of [...porTenant, ...porIdentificador, ...porAlerta]) {
            dedup.set(r.id, r);
        }
        const reportes = Array.from(dedup.values());

        const porEstado: Partial<Record<EstadoReporte, number>> = {};
        let ultimaActividad: Date | null = null;
        for (const r of reportes) {
            porEstado[r.estado] = (porEstado[r.estado] ?? 0) + 1;
            if (!ultimaActividad || r.creadoEn > ultimaActividad) ultimaActividad = r.creadoEn;
        }

        const casosAbiertos = await this.db.alertaColegio.count({
            where: { colegioId, estado: { in: [...ALERTA_ESTADOS_ABIERTOS] } },
        });

        return {
            reportes,
            total: reportes.length,
            porEstado,
            casosAbiertos,
            ultimaActividad,
        };
    }

    private async recolectarIdentificadoresEnrolados(
        colegioId: string
    ): Promise<Array<{ valor: string; plataformaId: string }>> {
        const [profesores, acudientes, estudiantes] = await Promise.all([
            this.db.identificadorProfesor.findMany({
                where: { colegioId, plataformaId: { not: null } },
                select: { valor: true, plataformaId: true },
            }),
            this.db.identificadorAcudiente.findMany({
                where: { colegioId, plataformaId: { not: null } },
                select: { valor: true, plataformaId: true },
            }),
            this.db.identificadorEstudiante.findMany({
                where: {
                    plataformaId: { not: null },
                    estudiante: { colegioId },
                },
                select: { valor: true, plataformaId: true },
            }),
        ]);
        const pares: Array<{ valor: string; plataformaId: string }> = [];
        for (const row of [...profesores, ...acudientes, ...estudiantes]) {
            if (row.plataformaId) pares.push({ valor: row.valor, plataformaId: row.plataformaId });
        }
        return pares;
    }

    private async recolectarReporteIdsPorAlerta(colegioId: string): Promise<string[]> {
        const alertas = await this.db.alertaColegio.findMany({
            where: { colegioId },
            select: { reporteId: true },
        });
        return alertas.map((a) => a.reporteId);
    }
}
