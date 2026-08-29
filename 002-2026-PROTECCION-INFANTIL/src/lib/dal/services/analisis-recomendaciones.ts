/**
 * SPEC-227 (002-PI-128): servicio del historial de recomendaciones y métricas
 * de tuning. SOLO LECTURA sobre el dominio de recomendaciones (FR-014): la
 * resolución de sugerencias vive en SPEC-221/226. Las rutas validan (Zod) y
 * serializan; toda la consulta vive aquí y en el repositorio DAL (frontera Q-3).
 *
 * Tasas sobre RESUELTAS (`APLICADA + IGNORADA + EXPIRADA`): las PENDIENTE
 * cuentan en "total generadas" pero no en el denominador (US-2); división por
 * cero → `null` (la UI muestra "—"). Las métricas miden desempeño de las
 * reglas del sistema, nunca de clientes ni personas.
 */
import type { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import type { FiltrosHistorial, FiltrosHistorialQuery } from "@/lib/analisis/filtros-historial";
import { ParametroRepository } from "../repositories/parametro";
import {
    AnalisisRecomendacionesRepository,
    construirWhereHistorial,
    type RecomendacionConRegla,
    type RecomendacionExportDb,
} from "../repositories/analisis-recomendaciones-repository";

export const CLAVE_UMBRAL_IGNORADA = "analisis.recomendaciones.tasa_ignorada_alerta_pct";
export const CLAVE_EXPORT_MAX_FILAS = "analisis.recomendaciones.export_max_filas";
const UMBRAL_IGNORADA_DEFAULT = 70;
const EXPORT_MAX_FILAS_DEFAULT = 5000;

/** Código canónico 413 (constitución §3.4); `ERROR_CODES` no lo contempla aún. */
export const CODIGO_PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE";

export interface ItemHistorial {
    id: string;
    titulo: string;
    regla: { id: string; clave: string; nombre: string };
    categoria: string;
    prioridad: number;
    estado: string;
    generadaEn: string;
    resueltaEn: string | null;
    ejecutadaAutomatica: boolean;
    sujetoTipo: string | null;
    sujetoId: string | null;
}

export interface MetricasPorRegla {
    reglaId: string;
    reglaClave: string;
    reglaNombre: string;
    totalGeneradas: number;
    tasaAplicacionPct: number | null;
    tasaIgnoradaPct: number | null;
    tasaExpiradaPct: number | null;
    tiempoPromedioResolucionHoras: number | null;
    sobreUmbralAlerta: boolean;
}

export interface MetricasHistorial {
    rango: { desde: string | null; hasta: string | null };
    totalGeneradas: number;
    totalResueltas: number;
    pendientes: number;
    tasaAplicacionPct: number | null;
    tasaIgnoradaPct: number | null;
    tasaExpiradaPct: number | null;
    tiempoPromedioResolucionHoras: number | null;
    umbralAlertaIgnoradaPct: number;
    porRegla: MetricasPorRegla[];
}

function redondear1(valor: number): number {
    return Math.round(valor * 10) / 10;
}

/** Porcentaje sobre el denominador de resueltas; `null` si no hay resueltas. */
function tasa(parcial: number, resueltas: number): number | null {
    if (resueltas === 0) return null;
    return redondear1((parcial * 100) / resueltas);
}

function serializarItem(r: RecomendacionConRegla): ItemHistorial {
    return {
        id: r.id,
        titulo: r.titulo,
        regla: { id: r.regla.id, clave: r.regla.clave, nombre: r.regla.nombre },
        categoria: r.categoria,
        prioridad: r.prioridad,
        estado: r.estado,
        generadaEn: r.generadaEn.toISOString(),
        resueltaEn: r.resueltaEn ? r.resueltaEn.toISOString() : null,
        ejecutadaAutomatica: r.ejecutadaAutomatica,
        sujetoTipo: r.sujetoTipo,
        sujetoId: r.sujetoId,
    };
}

interface Conteos {
    aplicadas: number;
    ignoradas: number;
    expiradas: number;
    pendientes: number;
}

function reducirConteos(filas: { estado: string; total: number }[]): Conteos {
    const conteos: Conteos = { aplicadas: 0, ignoradas: 0, expiradas: 0, pendientes: 0 };
    for (const fila of filas) {
        if (fila.estado === "APLICADA") conteos.aplicadas += fila.total;
        else if (fila.estado === "IGNORADA") conteos.ignoradas += fila.total;
        else if (fila.estado === "EXPIRADA") conteos.expiradas += fila.total;
        else if (fila.estado === "PENDIENTE") conteos.pendientes += fila.total;
    }
    return conteos;
}

export class AnalisisRecomendacionesService {
    private readonly repo: AnalisisRecomendacionesRepository;
    private readonly parametros: ParametroRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.repo = new AnalisisRecomendacionesRepository(tx);
        this.parametros = new ParametroRepository(tx);
    }

    /** GET /api/admin/analisis/recomendaciones — lista paginada estándar. */
    async listar(filtros: FiltrosHistorial, page: number, pageSize: number) {
        const where = construirWhereHistorial(filtros);
        const [items, total] = await this.repo.findPaginadasConTotal(where, {
            skip: (page - 1) * pageSize,
            take: pageSize,
        });
        return {
            items: items.map(serializarItem),
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    /** GET .../recomendaciones/metricas — agregados del conjunto filtrado. */
    async metricas(
        filtros: FiltrosHistorial,
        rango: { desde?: string | undefined; hasta?: string | undefined }
    ): Promise<MetricasHistorial> {
        const where = construirWhereHistorial(filtros);
        const [porEstado, porReglaEstado, promedioGlobal, promedioPorRegla, umbral] = await Promise.all([
            this.repo.conteoPorEstado(where),
            this.repo.conteoPorReglaYEstado(where),
            this.repo.promedioResolucionHorasGlobal(filtros),
            this.repo.promedioResolucionHorasPorRegla(filtros),
            this.obtenerUmbralAlerta(),
        ]);

        const globales = reducirConteos(porEstado);
        const totalResueltas = globales.aplicadas + globales.ignoradas + globales.expiradas;
        const totalGeneradas = totalResueltas + globales.pendientes;

        // Agregación por regla a partir de los conteos (regla, estado).
        const idsReglas = [...new Set(porReglaEstado.map((f) => f.reglaId))];
        const reglas = await this.repo.findReglasPorIds(idsReglas);
        const reglaPorId = new Map(reglas.map((r) => [r.id, r]));

        const conteosPorRegla = new Map<string, Conteos>();
        for (const fila of porReglaEstado) {
            const actual = conteosPorRegla.get(fila.reglaId) ?? {
                aplicadas: 0,
                ignoradas: 0,
                expiradas: 0,
                pendientes: 0,
            };
            if (fila.estado === "APLICADA") actual.aplicadas += fila.total;
            else if (fila.estado === "IGNORADA") actual.ignoradas += fila.total;
            else if (fila.estado === "EXPIRADA") actual.expiradas += fila.total;
            else if (fila.estado === "PENDIENTE") actual.pendientes += fila.total;
            conteosPorRegla.set(fila.reglaId, actual);
        }

        const porRegla: MetricasPorRegla[] = idsReglas.map((reglaId) => {
            const conteos = conteosPorRegla.get(reglaId) ?? {
                aplicadas: 0,
                ignoradas: 0,
                expiradas: 0,
                pendientes: 0,
            };
            const resueltas = conteos.aplicadas + conteos.ignoradas + conteos.expiradas;
            const tasaIgnorada = tasa(conteos.ignoradas, resueltas);
            const regla = reglaPorId.get(reglaId);
            const promedio = promedioPorRegla.get(reglaId) ?? null;
            return {
                reglaId,
                // Regla eliminada/renombrada: se muestra el id crudo sin romper (edge case).
                reglaClave: regla?.clave ?? reglaId,
                reglaNombre: regla?.nombre ?? reglaId,
                totalGeneradas: resueltas + conteos.pendientes,
                tasaAplicacionPct: tasa(conteos.aplicadas, resueltas),
                tasaIgnoradaPct: tasaIgnorada,
                tasaExpiradaPct: tasa(conteos.expiradas, resueltas),
                tiempoPromedioResolucionHoras: promedio === null ? null : redondear1(promedio),
                sobreUmbralAlerta: tasaIgnorada !== null && tasaIgnorada > umbral,
            };
        });
        // Las peor calibradas primero (tasa de ignorada desc; sin resueltas al final).
        porRegla.sort((a, b) => (b.tasaIgnoradaPct ?? -1) - (a.tasaIgnoradaPct ?? -1));

        return {
            rango: { desde: rango.desde ?? null, hasta: rango.hasta ?? null },
            totalGeneradas,
            totalResueltas,
            pendientes: globales.pendientes,
            tasaAplicacionPct: tasa(globales.aplicadas, totalResueltas),
            tasaIgnoradaPct: tasa(globales.ignoradas, totalResueltas),
            tasaExpiradaPct: tasa(globales.expiradas, totalResueltas),
            tiempoPromedioResolucionHoras: promedioGlobal === null ? null : redondear1(promedioGlobal),
            umbralAlertaIgnoradaPct: umbral,
            porRegla,
        };
    }

    /**
     * GET .../recomendaciones/export — dataset del CSV. 413 si el conjunto
     * filtrado supera `analisis.recomendaciones.export_max_filas` (FR-006).
     */
    async prepararExport(filtros: FiltrosHistorial): Promise<{ filas: RecomendacionExportDb[]; total: number }> {
        const where = construirWhereHistorial(filtros);
        const maxFilas = await this.obtenerExportMaxFilas();
        const total = await this.repo.contar(where);
        if (total > maxFilas) {
            throw new AppError(
                `El conjunto filtrado supera el máximo de ${maxFilas} filas. Refina los filtros.`,
                CODIGO_PAYLOAD_TOO_LARGE,
                413
            );
        }
        const filas = await this.repo.findParaExport(where);
        return { filas, total };
    }

    /** FR-008: auditoría de la exportación (filtros + conteo, nunca contenido). */
    async registrarAuditoriaExport(params: {
        usuarioId: string;
        filtros: FiltrosHistorialQuery;
        filasExportadas: number;
        ipAddress: string;
        userAgent: string;
    }): Promise<void> {
        await this.repo.registrarAuditoriaExport({
            usuarioId: params.usuarioId,
            metadatos: {
                filtros: params.filtros as unknown as Prisma.InputJsonValue,
                filasExportadas: params.filasExportadas,
            } as Prisma.InputJsonValue,
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
        });
    }

    /** Reglas para el select de filtro de la vista (page server component). */
    listarReglasParaFiltro() {
        return this.repo.listarReglasParaFiltro();
    }

    private async obtenerUmbralAlerta(): Promise<number> {
        const param = await this.parametros.findByClave(CLAVE_UMBRAL_IGNORADA);
        const valor = parseFloat(param?.valor ?? "");
        return Number.isFinite(valor) ? valor : UMBRAL_IGNORADA_DEFAULT;
    }

    private async obtenerExportMaxFilas(): Promise<number> {
        const param = await this.parametros.findByClave(CLAVE_EXPORT_MAX_FILAS);
        const valor = parseInt(param?.valor ?? "", 10);
        return Number.isFinite(valor) && valor > 0 ? valor : EXPORT_MAX_FILAS_DEFAULT;
    }
}
