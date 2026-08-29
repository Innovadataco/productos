/**
 * SPEC-053 (FR-004, US1): ReporteQueryService.
 * Listados, detalle privado del padre y seguimiento público con DTOs de dominio.
 * El mapeo (estado visual, SLA, ranking, grupos de categoría) vive aquí; las
 * rutas solo autentican, validan entrada y serializan el DTO (FR-002/FR-007).
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { calcularRanking } from "@/lib/ranking";
import { getParametroSistemaValor } from "@/lib/parametros";
import { mapEstadoUsuario, getMensajeUsuario, parseSlaHoras } from "@/lib/reporte-estados-usuario";
import { obtenerGruposCategoria, nombreGrupoParaCategoria } from "@/lib/categoria-grupos";
import { formatPlataforma } from "@/lib/plataforma";
import { formatCategoria } from "@/lib/labels";
import { construirExplicacionPadre } from "@/lib/expediente/mensaje-padre";
import { whereReporteVigente } from "@/lib/reportes-acceso";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { EstadoReporte } from "@prisma/client";
import { ReporteRepository } from "../repositories/reporte";
import { IdentificadorReportadoRepository } from "../repositories/identificador-reportado";
import type {
    DetallePadreDto,
    MisReportesDto,
    RankingResumenDto,
    ReporteListItemDto,
    SeguimientoDto,
} from "../types/reporte";

const ESTADOS_CLASIFICACION_FINAL: EstadoReporte[] = ["CLASIFICADO", "CORREGIDO"];

/** Categorías internas que NUNCA se muestran al padre (spec 093-US2). */
const CATEGORIAS_OCULTAS = new Set(["SPAM", "OTRO"]);

function categoriasDeSecundarias(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const cats: string[] = [];
    for (const item of value) {
        if (typeof item === "object" && item !== null) {
            const cat = (item as { categoria?: unknown }).categoria;
            if (typeof cat === "string") cats.push(cat);
        }
    }
    return cats;
}

export class ReporteQueryService {
    private readonly reportes: ReporteRepository;
    private readonly identificadores: IdentificadorReportadoRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.reportes = new ReporteRepository(tx);
        this.identificadores = new IdentificadorReportadoRepository(tx);
    }

    /** GET /api/reportes/mis-reportes — listado paginado del padre autenticado. */
    async misReportes(input: { usuarioId: string; page: number; pageSize: number }): Promise<MisReportesDto> {
        const { usuarioId, page, pageSize } = input;
        const skip = (page - 1) * pageSize;
        const baseWhere: Prisma.ReporteWhereInput = whereReporteVigente({ usuarioId });

        const [items, total] = await this.reportes.findPaginadosConTotal(baseWhere, { skip, take: pageSize });

        const identificadoresVisibles = await this.identificadores.findClavesVisibles(
            items.map((r) => ({ identificador: r.identificador, plataformaId: r.plataformaId }))
        );

        const rankingCache = new Map<string, RankingResumenDto>();
        const slaRaw = await getParametroSistemaValor("ui.sla_horas_procesamiento");
        const slaHoras = parseSlaHoras(slaRaw);
        const gruposCategoria = await obtenerGruposCategoria();

        const mapped: ReporteListItemDto[] = await Promise.all(
            items.map(async (r) => {
                const key = `${r.identificador}::${r.plataformaId}`;
                let ranking: RankingResumenDto | null = null;
                if (identificadoresVisibles.has(key) && !rankingCache.has(key)) {
                    const resultado = await calcularRanking(r.identificador, r.plataformaId);
                    rankingCache.set(key, {
                        score: resultado.score,
                        nivelRiesgo: resultado.nivelRiesgo,
                        totalReportes: resultado.totalReportes,
                    });
                }
                const cached = rankingCache.get(key);
                if (cached) ranking = cached;

                const estadoUsuario = mapEstadoUsuario(r.estado);

                return {
                    id: r.id,
                    identificador: r.identificador,
                    plataforma: formatPlataforma(r.plataforma.nombre, r.otraPlataforma, r.plataforma.clave),
                    estadoInterno: r.estado,
                    estadoVisual: estadoUsuario.estadoVisual,
                    badge: estadoUsuario.badge,
                    enProceso: estadoUsuario.enProceso,
                    mensaje: getMensajeUsuario(r.estado, slaHoras),
                    slaHoras,
                    numeroSeguimiento: r.numeroSeguimiento,
                    ciudad: r.ciudad,
                    pais: r.pais,
                    esAnonimo: r.esAnonimo,
                    creadoEn: r.creadoEn.toISOString(),
                    clasificacion:
                        r.clasificacion && ESTADOS_CLASIFICACION_FINAL.includes(r.estado)
                            ? {
                                categoria: r.clasificacion.categoria,
                                categoriaLabel: formatCategoria(r.clasificacion.categoria),
                                categoriaGrupo: nombreGrupoParaCategoria(gruposCategoria, r.clasificacion.categoria),
                            }
                            : null,
                    ranking,
                };
            })
        );

        return {
            items: mapped,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        };
    }

    /**
     * GET /api/reportes/seguimiento/[numero] — seguimiento público.
     * Devuelve null si no existe o está eliminado (la ruta responde 404).
     * Spec 089-US6: nunca score ni etiqueta de riesgo; solo conteos agregados.
     */
    async seguimiento(numero: string): Promise<SeguimientoDto | null> {
        const reporte = await this.reportes.findByNumeroSeguimiento(numero);
        if (!reporte || reporte.eliminado) return null;

        const identificadorReportado = await this.identificadores.findByPar(reporte.identificador, reporte.plataformaId);

        let ranking = null;
        if (identificadorReportado?.esVisiblePublicamente) {
            ranking = await calcularRanking(reporte.identificador, reporte.plataformaId);
        }

        const slaRaw = await getParametroSistemaValor("ui.sla_horas_procesamiento");
        const actividadAltaMin = parseInt((await getParametroSistemaValor("visibility.actividad_alta_min")) ?? "5", 10);
        const slaHoras = parseSlaHoras(slaRaw);
        const estadoUsuario = mapEstadoUsuario(reporte.estado);
        const mensaje = getMensajeUsuario(reporte.estado, slaHoras);
        const gruposCategoria = await obtenerGruposCategoria();

        return {
            numeroSeguimiento: reporte.numeroSeguimiento,
            estadoVisual: estadoUsuario.estadoVisual,
            estadoInterno: reporte.estado,
            badge: estadoUsuario.badge,
            enProceso: estadoUsuario.enProceso,
            mensaje,
            slaHoras,
            creadoEn: reporte.creadoEn,
            actualizadoEn: reporte.actualizadoEn,
            identificador: reporte.identificador,
            plataforma: formatPlataforma(reporte.plataforma.nombre, reporte.otraPlataforma, reporte.plataforma.clave),
            clasificacion:
                reporte.clasificacion && ESTADOS_CLASIFICACION_FINAL.includes(reporte.estado)
                    ? {
                        categoria: reporte.clasificacion.categoria,
                        categoriaLabel: formatCategoria(reporte.clasificacion.categoria),
                        categoriaGrupo: nombreGrupoParaCategoria(gruposCategoria, reporte.clasificacion.categoria),
                        categoriasSecundarias: categoriasDeSecundarias(reporte.clasificacion.categoriasSecundarias ?? []),
                        contienePii: reporte.clasificacion.contienePii,
                    }
                    : null,
            actividad: ranking ? (ranking.totalReportes >= actividadAltaMin ? "alta" : "baja") : null,
            ranking: ranking
                ? {
                    totalReportes: ranking.totalReportes,
                    reportesAutenticados: ranking.reportesAutenticados,
                    reportesAnonimos: ranking.reportesAnonimos,
                }
                : null,
        };
    }

    /**
     * GET /api/reportes/mis-reportes/[id] — detalle PRIVADO del reporte (spec 090
     * US3; contrato rehecho en spec 116). Lanza AppError 404/403 como la ruta original.
     * El padre ve SOLO las conductas CONFIRMADAS y su explicación determinista (D-23);
     * la traza técnica es superficie del admin (D-22) y NUNCA sale por aquí.
     */
    async detallePadre(id: string, usuarioId: string): Promise<DetallePadreDto> {
        const reporte = await this.reportes.findByIdConDetalle(id);

        if (!reporte || reporte.eliminado) {
            throw new AppError("Reporte no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        if (reporte.usuarioId !== usuarioId) {
            throw new AppError("Este reporte pertenece a otro usuario", ERROR_CODES.FORBIDDEN, 403);
        }

        const estadoUsuario = mapEstadoUsuario(reporte.estado);
        const reporteJson = {
            id: reporte.id,
            identificador: reporte.identificador,
            plataforma: formatPlataforma(reporte.plataforma.nombre, reporte.otraPlataforma, reporte.plataforma.clave),
            ciudad: reporte.ciudad,
            pais: reporte.pais,
            creadoEn: reporte.creadoEn.toISOString(),
            estadoVisual: estadoUsuario.estadoVisual,
            badge: estadoUsuario.badge,
            enProceso: estadoUsuario.enProceso,
        };

        const clasificacion = reporte.clasificacion;
        if (!clasificacion) {
            return { reporte: reporteJson, clasificacion: null };
        }

        // Conductas CONFIRMADAS = principal + secundarias persistidas (el motor ya
        // guarda en secundarias SOLO las que superaron el umbral de presencia).
        const confirmadas = [clasificacion.categoria, ...categoriasDeSecundarias(clasificacion.categoriasSecundarias)].filter(
            (cat, i, arr) => !CATEGORIAS_OCULTAS.has(cat) && arr.indexOf(cat) === i
        );

        return {
            reporte: reporteJson,
            clasificacion: {
                conductas: confirmadas.map((cat) => ({ categoria: cat, label: formatCategoria(cat) })),
                mensaje: construirExplicacionPadre(confirmadas),
            },
        };
    }
}
