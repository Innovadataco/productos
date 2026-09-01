/**
 * SPEC-168 (Fase F): bandeja de casos escalados al Comité de Convivencia,
 * colegio-scoped por construcción.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const SELECT_BANDEJA = {
    id: true,
    numero: true,
    estado: true,
    motivo: true,
    creadoEn: true,
    resueltoEn: true,
} satisfies Prisma.SolicitudComiteSelect;

export type SolicitudComiteConvivenciaRow = Prisma.SolicitudComiteGetPayload<{ select: typeof SELECT_BANDEJA }>;

const DIA_MS = 24 * 60 * 60 * 1000;
/** America/Bogota = UTC-5 fijo (sin horario de verano). */
const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;

/**
 * Lunes 00:00 America/Bogota de la semana de `fecha`, como instante UTC real.
 * Misma convención lunes-domingo que `inicioSemanaBogota` (src/lib/colegio/avisos.ts);
 * se duplica aquí para no arrastrar las dependencias de avisos (email/colas) al DAL.
 */
function lunesSemanaBogota(fecha: Date): Date {
    const relojBogota = new Date(fecha.getTime() - OFFSET_BOGOTA_MS);
    const desplazamiento = (relojBogota.getUTCDay() + 6) % 7; // lunes = 0
    const medianocheUtcDelLunes = Date.UTC(
        relojBogota.getUTCFullYear(),
        relojBogota.getUTCMonth(),
        relojBogota.getUTCDate() - desplazamiento
    );
    return new Date(medianocheUtcDelLunes + OFFSET_BOGOTA_MS);
}

export class ComiteConvivenciaSolicitudesRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    listarPorColegio(
        colegioId: string,
        paginacion: { skip: number; take: number }
    ): Promise<[SolicitudComiteConvivenciaRow[], number]> {
        const where = { colegioId };
        return Promise.all([
            this.db.solicitudComite.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
                select: SELECT_BANDEJA,
            }),
            this.db.solicitudComite.count({ where }),
        ]);
    }

    obtenerPorId(id: string) {
        return this.db.solicitudComite.findUnique({
            where: { id },
            select: {
                ...SELECT_BANDEJA,
                colegioId: true,
                alertaColegioId: true,
                reporteId: true,
                resolucion: true,
            },
        });
    }

    obtenerPorAlertaId(alertaColegioId: string) {
        return this.db.solicitudComite.findUnique({
            where: { alertaColegioId },
            select: { id: true },
        });
    }

    crear(data: Prisma.SolicitudComiteUncheckedCreateInput) {
        return this.db.solicitudComite.create({
            data,
            select: SELECT_BANDEJA,
        });
    }

    // SPEC-319 §2.4: `integranteFirmanteId` registra qué integrante firmó el cierre
    // (requerido — el servicio valida que sea un integrante activo del comité).
    resolver(id: string, resolucion: string, integranteFirmanteId: string) {
        return this.db.solicitudComite.update({
            where: { id },
            data: { estado: "RESUELTA", resolucion, resueltoEn: new Date(), integranteFirmanteId },
            select: SELECT_BANDEJA,
        });
    }

    /**
     * SPEC-173: resumen para la home del comité. Solo metadatos (número,
     * categoría, estado, fechas, SLA); nunca texto de reporte ni denunciante.
     */
    async resumenPorColegio(colegioId: string, usuarioId: string, slaHasta: Date, takeSla: number) {
        const abiertos: Prisma.SolicitudComiteWhereInput = { colegioId, estado: "PENDIENTE" };
        const [casosAbiertos, misCasosAsignados, proximosSla] = await Promise.all([
            this.db.solicitudComite.count({ where: abiertos }),
            this.db.solicitudComite.count({
                where: { ...abiertos, alerta: { asignadoAId: usuarioId } },
            }),
            this.db.solicitudComite.findMany({
                where: { ...abiertos, alerta: { vencimientoSla: { lte: slaHasta } } },
                orderBy: { alerta: { vencimientoSla: "asc" } },
                take: takeSla,
                select: {
                    id: true,
                    numero: true,
                    estado: true,
                    creadoEn: true,
                    alerta: { select: { prioridad: true, vencimientoSla: true } },
                    reporte: { select: { clasificacion: { select: { categoria: true } } } },
                },
            }),
        ]);
        return { casosAbiertos, misCasosAsignados, proximosSla };
    }

    /**
     * SPEC-353 (A-69 · C6): casos abiertos del comité + antigüedad del más
     * viejo, para la frase "El comité tiene un caso desde hace N días" del
     * puesto de mando del rector. Solo conteos y fechas — cero contenido.
     */
    async abiertosConAntiguedad(colegioId: string): Promise<{ abiertos: number; masViejoEn: Date | null }> {
        const where: Prisma.SolicitudComiteWhereInput = { colegioId, estado: "PENDIENTE" };
        const [abiertos, masViejo] = await Promise.all([
            this.db.solicitudComite.count({ where }),
            this.db.solicitudComite.aggregate({ where, _min: { creadoEn: true } }),
        ]);
        return { abiertos, masViejoEn: masViejo._min.creadoEn };
    }

    /** SPEC-173: agregados de la bandeja, colegio-scoped. */
    async estadisticasPorColegio(colegioId: string, takeTopCategorias: number) {
        const [porEstado, resueltas, porCategoria] = await Promise.all([
            this.db.solicitudComite.groupBy({
                by: ["estado"],
                where: { colegioId },
                _count: { _all: true },
            }),
            this.db.solicitudComite.findMany({
                where: { colegioId, resueltoEn: { not: null } },
                select: { creadoEn: true, resueltoEn: true },
            }),
            this.db.clasificacionIA.groupBy({
                by: ["categoria"],
                where: { reporte: { solicitudComite: { colegioId } } },
                _count: { _all: true },
                orderBy: { _count: { categoria: "desc" } },
                take: takeTopCategorias,
            }),
        ]);
        return { porEstado, resueltas, porCategoria };
    }

    /**
     * SPEC-177: casos creados y resueltos por semana (lunes-domingo,
     * America/Bogota), últimas `semanas` semanas incluyendo la actual.
     * Devuelve siempre `semanas` entradas — las semanas sin movimiento van en
     * cero para que el eje del gráfico no tenga huecos.
     */
    async tendenciaSemanal(colegioId: string, semanas = 8) {
        const lunesActual = lunesSemanaBogota(new Date());
        const inicioVentana = new Date(lunesActual.getTime() - (semanas - 1) * 7 * DIA_MS);

        const filas = await this.db.solicitudComite.findMany({
            where: {
                colegioId,
                OR: [{ creadoEn: { gte: inicioVentana } }, { resueltoEn: { gte: inicioVentana } }],
            },
            select: { creadoEn: true, resueltoEn: true },
        });

        // Buckets fijos (uno por semana, del más viejo al actual).
        const buckets = new Map<string, { semanaInicio: string; creados: number; resueltos: number }>();
        for (let i = semanas - 1; i >= 0; i--) {
            const lunes = new Date(lunesActual.getTime() - i * 7 * DIA_MS);
            const clave = lunes.toISOString().slice(0, 10);
            buckets.set(clave, { semanaInicio: clave, creados: 0, resueltos: 0 });
        }

        for (const fila of filas) {
            const bucketCreado = buckets.get(lunesSemanaBogota(fila.creadoEn).toISOString().slice(0, 10));
            if (bucketCreado) bucketCreado.creados++;
            if (fila.resueltoEn) {
                const bucketResuelto = buckets.get(lunesSemanaBogota(fila.resueltoEn).toISOString().slice(0, 10));
                if (bucketResuelto) bucketResuelto.resueltos++;
            }
        }

        return [...buckets.values()];
    }

    /**
     * SPEC-177: cumplimiento del SLA. "A tiempo" = resuelto antes de
     * `alerta.vencimientoSla`; vencido = resuelto tarde o aún pendiente con la
     * fecha límite ya pasada. Los casos sin alerta vinculada no entran al %.
     * Los pendientes con SLA vigente tampoco entran (aún no vencen).
     */
    async cumplimientoSla(colegioId: string) {
        const filas = await this.db.solicitudComite.findMany({
            where: { colegioId },
            select: {
                resueltoEn: true,
                alerta: { select: { vencimientoSla: true } },
            },
        });

        const ahora = new Date();
        let aTiempo = 0;
        let vencidos = 0;
        let sinSla = 0;
        for (const fila of filas) {
            const vencimiento = fila.alerta?.vencimientoSla;
            if (!vencimiento) {
                sinSla++;
                continue;
            }
            if (fila.resueltoEn) {
                if (fila.resueltoEn <= vencimiento) aTiempo++;
                else vencidos++;
            } else if (vencimiento < ahora) {
                vencidos++;
            }
        }

        const evaluables = aTiempo + vencidos;
        return {
            aTiempo,
            vencidos,
            sinSla,
            pctATiempo: evaluables > 0 ? Math.round((aTiempo / evaluables) * 100) : null,
        };
    }

    /**
     * SPEC-177: días promedio de resolución por categoría de la clasificación
     * del reporte (mismo camino que el top de categorías), solo casos
     * resueltos. Casos sin clasificación no aportan a ninguna categoría.
     */
    async tiempoMedioPorCategoria(colegioId: string) {
        const filas = await this.db.solicitudComite.findMany({
            where: { colegioId, resueltoEn: { not: null } },
            select: {
                creadoEn: true,
                resueltoEn: true,
                reporte: { select: { clasificacion: { select: { categoria: true } } } },
            },
        });

        const acumulado = new Map<string, { totalMs: number; resueltos: number }>();
        for (const fila of filas) {
            const categoria = fila.reporte.clasificacion?.categoria;
            if (!categoria || !fila.resueltoEn) continue;
            const entrada = acumulado.get(categoria) ?? { totalMs: 0, resueltos: 0 };
            entrada.totalMs += fila.resueltoEn.getTime() - fila.creadoEn.getTime();
            entrada.resueltos++;
            acumulado.set(categoria, entrada);
        }

        return [...acumulado.entries()]
            .map(([categoria, { totalMs, resueltos }]) => ({
                categoria,
                dias: Math.round((totalMs / resueltos / DIA_MS) * 10) / 10,
                resueltos,
            }))
            .sort((a, b) => b.dias - a.dias || a.categoria.localeCompare(b.categoria));
    }
}
