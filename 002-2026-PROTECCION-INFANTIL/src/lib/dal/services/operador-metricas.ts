/**
 * SPEC-189 (002-PI-084): servicio de métricas y listado de casos por operador.
 * Solo lectura; usa repositorios del DAL (FR-010).
 */
import type { EstadoReporte, Prisma } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { whereReporteEnEstado, whereReporteVigente } from "@/lib/reportes-acceso";
import { UsuarioRepository } from "../repositories/usuario";
import { ReporteRepository } from "../repositories/reporte";
import { ReporteOperadorRepository } from "../repositories/reporte-operador";
import { AuditLogRepository } from "../repositories/audit-log";
import type {
    CasoAbiertoMetricaDto,
    CasoOperadorListItemDto,
    MetricasOperadorDto,
} from "../types/operador";

const ACCIONES_CIERRE_OPERADOR: Array<"CASO_CONFIRMADO" | "CASO_CORREGIDO" | "CASO_DADO_DE_BAJA"> = [
    "CASO_CONFIRMADO",
    "CASO_CORREGIDO",
    "CASO_DADO_DE_BAJA",
];

const ACCION_ESCALADO: "CASO_ESCALADO" = "CASO_ESCALADO";

const ACCION_ASIGNACION: "OPERADOR_ASIGNADO" = "OPERADOR_ASIGNADO";

function inicioRango(dias: number, ahora: Date): Date {
    const d = new Date(ahora);
    d.setDate(d.getDate() - dias);
    d.setHours(0, 0, 0, 0);
    return d;
}

export class OperadorMetricasService {
    private readonly usuarios: UsuarioRepository;
    private readonly reportes: ReporteRepository;
    private readonly reportesOperador: ReporteOperadorRepository;
    private readonly audit: AuditLogRepository;

    constructor() {
        this.usuarios = new UsuarioRepository();
        this.reportes = new ReporteRepository();
        this.reportesOperador = new ReporteOperadorRepository();
        this.audit = new AuditLogRepository();
    }

    /** Valida que el usuario exista, sea OPERADOR y esté activo. */
    private async validarOperador(id: string) {
        const operador = await this.usuarios.findByIdConPerfil(id);
        if (!operador) {
            throw new AppError("Operador no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        if (operador.rol !== "OPERADOR") {
            throw new AppError("La ficha de operador solo aplica a usuarios con rol OPERADOR", "ROL_INVALIDO", 400);
        }
        if (operador.estado !== "activo") {
            throw new AppError("El operador no está activo", ERROR_CODES.FORBIDDEN, 403);
        }
        return operador;
    }

    /** SPEC-189: métricas de productividad del operador. */
    async obtenerMetricas(operadorId: string, ahora = new Date()): Promise<MetricasOperadorDto> {
        const operador = await this.validarOperador(operadorId);

        const [reportesAbiertos, resueltos24h, resueltos7d, resueltos30d, escalados30d, cierres30d] = await Promise.all([
            this.reportes.findBandejaRevision(
                whereReporteEnEstado("REVISION_MANUAL", { operadorId }),
                { skip: 0, take: 1000 },
                "recientes"
            ),
            this.audit.countAccionesPorUsuario(ACCIONES_CIERRE_OPERADOR, operadorId, {
                gte: inicioRango(1, ahora),
                lte: ahora,
            }),
            this.audit.countAccionesPorUsuario(ACCIONES_CIERRE_OPERADOR, operadorId, {
                gte: inicioRango(7, ahora),
                lte: ahora,
            }),
            this.audit.countAccionesPorUsuario(ACCIONES_CIERRE_OPERADOR, operadorId, {
                gte: inicioRango(30, ahora),
                lte: ahora,
            }),
            this.audit.countAccionesPorUsuario([ACCION_ESCALADO], operadorId, {
                gte: inicioRango(30, ahora),
                lte: ahora,
            }),
            this.audit.findCierresPorUsuario(ACCIONES_CIERRE_OPERADOR, operadorId, {
                gte: inicioRango(30, ahora),
                lte: ahora,
            }),
        ]);

        const [itemsAbiertos, _totalAbiertos] = reportesAbiertos;

        const recursoIdsAbiertos = itemsAbiertos.map((r) => r.id);
        const asignacionesAbiertos = await this.audit.findAsignaciones(recursoIdsAbiertos, operadorId);
        const asignadoEnPorReporte = new Map(asignacionesAbiertos.map((a) => [a.recursoId, a.creadoEn]));

        const casosAbiertos: CasoAbiertoMetricaDto[] = itemsAbiertos.map((r) => {
            const asignadoEn = asignadoEnPorReporte.get(r.id) ?? r.creadoEn;
            return {
                id: r.id,
                numeroSeguimiento: r.numeroSeguimiento,
                identificador: r.identificador,
                plataformaClave: r.plataforma?.clave ?? "",
                plataformaNombre: r.plataforma?.nombre ?? "Desconocida",
                categoria: r.clasificacion?.categoria ?? null,
                estado: r.estado,
                asignadoEn,
                tiempoDesdeAsignacionMs: ahora.getTime() - asignadoEn.getTime(),
            };
        });

        const recursoIdsCerrados = [...new Set(cierres30d.map((c) => c.recursoId).filter((id): id is string => id !== null))];
        const asignacionesCerrados = await this.audit.findAsignaciones(recursoIdsCerrados, operadorId);
        const primeraAsignacionCerrado = new Map<string, Date>();
        for (const a of asignacionesCerrados) {
            if (!a.recursoId) continue;
            if (!primeraAsignacionCerrado.has(a.recursoId) || a.creadoEn < primeraAsignacionCerrado.get(a.recursoId)!) {
                primeraAsignacionCerrado.set(a.recursoId, a.creadoEn);
            }
        }

        const tiemposResolucionMs: number[] = [];
        const recursoIdsResueltosParaCategorias = new Set<string>();
        for (const cierre of cierres30d) {
            if (!cierre.recursoId) continue;
            const asignadoEn = primeraAsignacionCerrado.get(cierre.recursoId);
            if (asignadoEn) {
                tiemposResolucionMs.push(cierre.creadoEn.getTime() - asignadoEn.getTime());
                recursoIdsResueltosParaCategorias.add(cierre.recursoId);
            }
        }

        const tiempoMedioResolucionMs = tiemposResolucionMs.length > 0
            ? Math.round(tiemposResolucionMs.reduce((a, b) => a + b, 0) / tiemposResolucionMs.length)
            : null;

        const casosPorCategoria = recursoIdsResueltosParaCategorias.size > 0
            ? await this.reportesOperador.categoriasPorIds([...recursoIdsResueltosParaCategorias])
            : [];

        const totalResueltosEscalados30d = resueltos30d + escalados30d;
        const tasaEscalamientoComite = totalResueltosEscalados30d > 0
            ? escalados30d / totalResueltosEscalados30d
            : null;

        return {
            operador: {
                id: operador.id,
                email: operador.email,
                nombre: operador.nombre,
                cupoMaximo: operador.perfilOperador?.cupoMaximo ?? 10,
            },
            casosAbiertos,
            casosResueltos24h: resueltos24h,
            casosResueltos7d: resueltos7d,
            casosResueltos30d: resueltos30d,
            tiempoMedioResolucionMs,
            casosPorCategoria,
            tasaEscalamientoComite,
        };
    }

    /** SPEC-189: listado paginado de casos del operador. */
    async listarCasos(
        operadorId: string,
        filtros: { estado?: EstadoReporte },
        paginacion: { page: number; pageSize: number }
    ): Promise<[CasoOperadorListItemDto[], number]> {
        await this.validarOperador(operadorId);

        const where: Prisma.ReporteWhereInput = whereReporteVigente({ operadorId });
        if (filtros.estado) {
            where.estado = filtros.estado;
        }

        const [items, total] = await this.reportesOperador.findCasosOperador(where, {
            skip: (paginacion.page - 1) * paginacion.pageSize,
            take: paginacion.pageSize,
        });

        const recursoIds = items.map((r) => r.id);
        const asignaciones = await this.audit.findAsignaciones(recursoIds, operadorId);
        const asignadoEnPorReporte = new Map(asignaciones.map((a) => [a.recursoId, a.creadoEn]));

        const dto: CasoOperadorListItemDto[] = items.map((r) => ({
            id: r.id,
            numeroSeguimiento: r.numeroSeguimiento,
            identificador: r.identificador,
            plataformaClave: r.plataforma?.clave ?? "",
            plataformaNombre: r.plataforma?.nombre ?? "Desconocida",
            estado: r.estado,
            categoria: r.clasificacion?.categoria ?? null,
            asignadoEn: asignadoEnPorReporte.get(r.id) ?? r.creadoEn,
        }));

        return [dto, total];
    }
}
