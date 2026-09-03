/**
 * SPEC-380 (PR B) · extractado de `alerta-colegio.ts` para respetar el ratchet
 * de max-lines (500 non-blank non-comment). Concentra los 3 métodos ligados
 * al `PatronInstitucional` (SPEC-142 · F6): cross-tenant a propósito, mismo
 * contrato E-1 (aceptan `DbClient` opcional).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class AlertaColegioPatronRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * SPEC-142 (F6) — EXCEPCIÓN cross-tenant (como buscarActivosPorValor): las
     * alertas de UN reporte con su vínculo y el grado del curso, más antiguas
     * primero (dedupe determinístico por colegio y snapshot del grado).
     */
    findPorReporteConVinculoYGrado(reporteId: string) {
        return this.db.alertaColegio.findMany({
            where: { reporteId, tipoSujeto: "ESTUDIANTE" },
            orderBy: { creadoEn: "asc" },
            select: {
                id: true,
                colegioId: true,
                patronInstitucionalId: true,
                identificadorEstudiante: {
                    select: {
                        estudiante: { select: { colegioId: true, curso: { select: { grado: true } } } },
                    },
                },
            },
        });
    }

    /** SPEC-142 (F6): marca la fila agregada que aportó esta alerta (idempotencia). */
    marcarPatron(id: string, patronInstitucionalId: string) {
        return this.db.alertaColegio.update({
            where: { id },
            data: { patronInstitucionalId },
        });
    }

    /** SPEC-142 (F6): alertas del reporte con aporte al agregado (reversa en baja). */
    findPorReporteConPatron(reporteId: string) {
        return this.db.alertaColegio.findMany({
            where: { reporteId, patronInstitucionalId: { not: null } },
            select: { id: true, patronInstitucionalId: true },
        });
    }
}
