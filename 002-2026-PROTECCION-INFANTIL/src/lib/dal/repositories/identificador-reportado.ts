/**
 * SPEC-053 (FR-001): repositorio de IdentificadorReportado.
 * Encapsula el upsert de agregación y las lecturas de visibilidad pública;
 * acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

// SPEC-181: orden cerrado de la simulación anti-abuso. El default `recientes`
// reproduce el orden histórico del repo (ultimoReporteEn desc).
export type OrdenSimulacion = "recientes" | "antiguos" | "score";

const ORDENES_SIMULACION: Record<OrdenSimulacion, Prisma.IdentificadorReportadoOrderByWithRelationInput[]> = {
    recientes: [{ ultimoReporteEn: "desc" }, { id: "asc" }],
    antiguos: [{ ultimoReporteEn: "asc" }, { id: "asc" }],
    score: [{ score: "desc" }, { ultimoReporteEn: "desc" }, { id: "asc" }],
};

export type FiltrosSimulacion = {
    q?: string | undefined;
    nivel?: string | undefined;
    plataformaId?: string | undefined;
    orden?: OrdenSimulacion | undefined;
};

function whereSimulacion(filtros: Omit<FiltrosSimulacion, "orden">): Prisma.IdentificadorReportadoWhereInput {
    const where: Prisma.IdentificadorReportadoWhereInput = {};
    if (filtros.q) {
        where.identificador = { contains: filtros.q, mode: "insensitive" };
    }
    if (filtros.nivel) {
        where.nivelRiesgo = filtros.nivel;
    }
    if (filtros.plataformaId) {
        where.plataformaId = filtros.plataformaId;
    }
    return where;
}

export class IdentificadorReportadoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findByPar(identificador: string, plataformaId: string) {
        return this.db.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador, plataformaId } },
        });
    }

    /**
     * Claves `identificador::plataformaId` de los identificadores visibles
     * públicamente entre los pares dados (para decorar listados con ranking).
     */
    async findClavesVisibles(pares: Array<{ identificador: string; plataformaId: string }>): Promise<Set<string>> {
        if (pares.length === 0) return new Set();
        const rows = await this.db.identificadorReportado.findMany({
            where: {
                identificador: { in: pares.map((p) => p.identificador) },
                plataformaId: { in: pares.map((p) => p.plataformaId) },
                esVisiblePublicamente: true,
            },
            select: { identificador: true, plataformaId: true },
        });
        return new Set(rows.map((i) => `${i.identificador}::${i.plataformaId}`));
    }

    /**
     * Upsert de agregación al crear un reporte (SPEC-110: un reporte NUEVO
     * levanta el ocultamiento por comité, sin lista blanca permanente).
     */
    upsertIncrementoReporte(input: { identificador: string; plataformaId: string; esAnonimo: boolean }) {
        const { identificador, plataformaId, esAnonimo } = input;
        return this.db.identificadorReportado.upsert({
            where: { identificador_plataformaId: { identificador, plataformaId } },
            update: {
                totalReportes: { increment: 1 },
                // undefined explícito ≡ omitir el incremento (exactOptionalPropertyTypes)
                ...(esAnonimo ? {} : { reportesAutenticados: { increment: 1 } }),
                ...(esAnonimo ? { reportesAnonimos: { increment: 1 } } : {}),
                ultimoReporteEn: new Date(),
                ocultoPorComiteEn: null,
            },
            create: {
                identificador,
                plataformaId,
                totalReportes: 1,
                reportesAutenticados: esAnonimo ? 0 : 1,
                reportesAnonimos: esAnonimo ? 1 : 0,
                ultimoReporteEn: new Date(),
            },
        });
    }

    /**
     * Marca del comité al aceptar una apelación (SPEC-110): oculta el agregado;
     * si no hay agregado no hay nada que ocultar (updateMany = no-op).
     */
    marcarOcultoPorComite(identificador: string, plataformaId: string, fecha: Date) {
        return this.db.identificadorReportado.updateMany({
            where: { identificador, plataformaId },
            data: { ocultoPorComiteEn: fecha },
        });
    }

    /**
     * E-8: página de identificadores para la simulación de score anti-abuso.
     * SPEC-181: filtros dinámicos (where tipado) y orden por mapa cerrado —
     * la entrada del cliente nunca se interpola en la consulta.
     */
    listarParaSimulacion(paginacion: { skip: number; take: number }, filtros: FiltrosSimulacion = {}) {
        return this.db.identificadorReportado.findMany({
            where: whereSimulacion(filtros),
            skip: paginacion.skip,
            take: paginacion.take,
            orderBy: ORDENES_SIMULACION[filtros.orden ?? "recientes"],
            select: { id: true, identificador: true, plataformaId: true },
        });
    }

    /** E-8: total de identificadores agregados (paginación de la simulación). */
    contarTodos(filtros: Omit<FiltrosSimulacion, "orden"> = {}): Promise<number> {
        return this.db.identificadorReportado.count({ where: whereSimulacion(filtros) });
    }

    /** SPEC-139 (F5): agregado por clave del match (identificador + plataforma). */
    findPorClave(identificador: string, plataformaId: string) {
        return this.db.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador, plataformaId } },
        });
    }
}
