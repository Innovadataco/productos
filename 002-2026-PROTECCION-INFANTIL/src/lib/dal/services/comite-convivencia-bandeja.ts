/**
 * SPEC-168 (Fase F): bandeja de casos del Comité de Convivencia — escalamiento,
 * detalle, resolución y notas. Todo colegio-scoped.
 */
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";
import { AlertaColegioRepository } from "../repositories/alerta-colegio";
import { ComiteConvivenciaRepository } from "../repositories/comite-convivencia";
import { ComiteConvivenciaSolicitudesRepository } from "../repositories/comite-convivencia-solicitudes";
import { obtenerDetalleCaso, agregarNotaCaso } from "@/lib/colegio/seguimiento";
import type {
    EscalarAlertaInput,
    ResolverSolicitudComiteInput,
    SolicitudComiteBandejaDto,
    DetalleSolicitudComiteDto,
    ResumenComiteHomeDto,
    EstadisticasComiteDto,
    InfoClienteDto,
} from "../types/comite-convivencia";

function numeroSolicitud(): string {
    const now = Date.now();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `SOL-CC-${now}-${rand}`;
}

function toBandejaDto(row: {
    id: string;
    numero: string;
    estado: string;
    motivo: string;
    creadoEn: Date;
    resueltoEn: Date | null;
}): SolicitudComiteBandejaDto {
    return {
        id: row.id,
        numero: row.numero,
        estado: row.estado,
        motivo: row.motivo,
        creadoEn: row.creadoEn.toISOString(),
        resueltoEn: row.resueltoEn?.toISOString() ?? null,
    };
}

export class ComiteConvivenciaBandejaService {
    private readonly solicitudes: ComiteConvivenciaSolicitudesRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.solicitudes = new ComiteConvivenciaSolicitudesRepository(tx);
    }

    private async assertColegioDeComite(comiteId: string): Promise<string> {
        const cuenta = await new ComiteConvivenciaRepository().obtenerPorId(comiteId);
        if (!cuenta || !cuenta.comiteColegioId) {
            throw new AppError("Cuenta del comité no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }
        return cuenta.comiteColegioId;
    }

    async listar(colegioId: string, page: number, pageSize: number) {
        const skip = (page - 1) * pageSize;
        const [rows, total] = await this.solicitudes.listarPorColegio(colegioId, { skip, take: pageSize });
        return {
            items: rows.map(toBandejaDto),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    /**
     * SPEC-173: resumen para la home del rol COMITE_CONVIVENCIA.
     * "Próximos a vencer" = SLA vencido o que vence en las próximas 24 h.
     */
    async resumen(colegioId: string, usuarioId: string): Promise<ResumenComiteHomeDto> {
        const slaHasta = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const { casosAbiertos, misCasosAsignados, proximosSla } = await this.solicitudes.resumenPorColegio(
            colegioId,
            usuarioId,
            slaHasta,
            5
        );
        return {
            casosAbiertos,
            misCasosAsignados,
            proximosVencerSla: proximosSla.map((row) => ({
                id: row.id,
                numero: row.numero,
                estado: row.estado,
                categoria: row.reporte.clasificacion?.categoria ?? null,
                creadoEn: row.creadoEn.toISOString(),
                prioridad: row.alerta?.prioridad ?? null,
                vencimientoSla: row.alerta?.vencimientoSla?.toISOString() ?? null,
            })),
        };
    }

    /**
     * SPEC-173: agregados de la bandeja del colegio. Tiempo medio de resolución
     * = AVG(resueltoEn - creadoEn) en días sobre solicitudes resueltas.
     * SPEC-177: + tendencia semanal, cumplimiento SLA, tiempo medio por
     * categoría y distribución por estado con %. Todo agregado, cero PII.
     */
    async estadisticas(colegioId: string): Promise<EstadisticasComiteDto> {
        const [{ porEstado, resueltas, porCategoria }, tendenciaSemanal, sla, tiempoMedioPorCategoria] =
            await Promise.all([
                this.solicitudes.estadisticasPorColegio(colegioId, 5),
                this.solicitudes.tendenciaSemanal(colegioId),
                this.solicitudes.cumplimientoSla(colegioId),
                this.solicitudes.tiempoMedioPorCategoria(colegioId),
            ]);

        const casosPorEstado: Record<string, number> = {};
        for (const fila of porEstado) {
            casosPorEstado[fila.estado] = fila._count._all;
        }

        const totalCasos = Object.values(casosPorEstado).reduce((acc, n) => acc + n, 0);
        const distribucionEstado = Object.entries(casosPorEstado)
            .map(([estado, total]) => ({
                estado,
                total,
                pct: totalCasos > 0 ? Math.round((total / totalCasos) * 100) : 0,
            }))
            .sort((a, b) => b.total - a.total || a.estado.localeCompare(b.estado));

        let tiempoMedioResolucionDias: number | null = null;
        if (resueltas.length > 0) {
            const totalMs = resueltas.reduce((acc, row) => {
                const fin = row.resueltoEn;
                return fin ? acc + (fin.getTime() - row.creadoEn.getTime()) : acc;
            }, 0);
            tiempoMedioResolucionDias = Math.round((totalMs / resueltas.length / (24 * 60 * 60 * 1000)) * 10) / 10;
        }

        return {
            casosPorEstado,
            tiempoMedioResolucionDias,
            topCategorias: porCategoria.map((fila) => ({
                categoria: fila.categoria,
                total: fila._count._all,
            })),
            distribucionEstado,
            tendenciaSemanal,
            sla,
            tiempoMedioPorCategoria,
        };
    }

    async obtenerDetalle(colegioId: string, solicitudId: string): Promise<DetalleSolicitudComiteDto> {
        const solicitud = await this.solicitudes.obtenerPorId(solicitudId);
        if (!solicitud || solicitud.colegioId !== colegioId || !solicitud.alertaColegioId) {
            throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        const caso = await obtenerDetalleCaso(colegioId, solicitud.alertaColegioId);
        return {
            solicitud: {
                id: solicitud.id,
                numero: solicitud.numero,
                estado: solicitud.estado,
                motivo: solicitud.motivo,
                resolucion: solicitud.resolucion,
                creadoEn: solicitud.creadoEn.toISOString(),
                resueltoEn: solicitud.resueltoEn?.toISOString() ?? null,
            },
            caso,
        };
    }

    async escalarAlerta(
        colegioId: string,
        alertaId: string,
        input: EscalarAlertaInput,
        actorId: string,
        info: InfoClienteDto
    ) {
        const alertas = new AlertaColegioRepository();
        const alerta = await alertas.obtenerPorId(colegioId, alertaId);
        if (!alerta) {
            throw new AppError("Alerta no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        const existente = await this.solicitudes.obtenerPorAlertaId(alertaId);
        if (existente) {
            throw new AppError("Esta alerta ya fue escalada al comité", ERROR_CODES.CONFLICT, 409);
        }

        if (alerta.estado !== "nueva" && alerta.estado !== "vista") {
            throw new AppError("Solo se pueden escalar alertas nuevas o vistas", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const cuenta = await new ComiteConvivenciaRepository().obtenerPorColegio(colegioId);
        if (!cuenta) {
            throw new AppError(
                "Debes crear primero la cuenta del Comité de Convivencia",
                ERROR_CODES.VALIDATION_ERROR,
                400
            );
        }

        await alertas.cambiarEstado(colegioId, alertaId, "escalada");

        const creada = await this.solicitudes.crear({
            reporteId: alerta.reporteId,
            numero: numeroSolicitud(),
            estado: "PENDIENTE",
            colegioId,
            alertaColegioId: alertaId,
            creadoPorId: actorId,
            motivo: input.motivo,
        });

        await logAudit({
            accion: "COLEGIO_CASO_ESCALADO_A_COMITE",
            tipoRecurso: "SolicitudComite",
            recursoId: creada.id,
            usuarioId: actorId,
            colegioId,
            valorNuevo: JSON.stringify({ alertaId, colegioId, motivoLength: input.motivo.length }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        return { solicitud: toBandejaDto(creada), alerta: { id: alertaId, estado: "escalada" } };
    }

    async resolver(
        colegioId: string,
        solicitudId: string,
        input: ResolverSolicitudComiteInput,
        actorId: string,
        info: InfoClienteDto
    ) {
        const solicitud = await this.solicitudes.obtenerPorId(solicitudId);
        if (!solicitud || solicitud.colegioId !== colegioId) {
            throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }
        if (solicitud.estado !== "PENDIENTE") {
            throw new AppError("La solicitud ya fue resuelta", ERROR_CODES.CONFLICT, 409);
        }
        if (!solicitud.alertaColegioId) {
            throw new AppError("Solicitud sin alerta asociada", ERROR_CODES.INTERNAL_ERROR, 500);
        }

        const alertas = new AlertaColegioRepository();
        await alertas.cambiarEstado(colegioId, solicitud.alertaColegioId, "gestionada");
        const resuelta = await this.solicitudes.resolver(solicitudId, input.resolucion);

        await logAudit({
            accion: "COLEGIO_CASO_RESUELTO_POR_COMITE",
            tipoRecurso: "SolicitudComite",
            recursoId: resuelta.id,
            usuarioId: actorId,
            colegioId,
            valorNuevo: JSON.stringify({ estado: "RESUELTA", resolucionLength: input.resolucion.length }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        return { solicitud: toBandejaDto(resuelta) };
    }

    async agregarNota(
        actor: { id: string; rol: string },
        colegioId: string,
        solicitudId: string,
        texto: string,
        request?: Request
    ) {
        const solicitud = await this.solicitudes.obtenerPorId(solicitudId);
        if (!solicitud || solicitud.colegioId !== colegioId || !solicitud.alertaColegioId) {
            throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        if (actor.rol === "COMITE_CONVIVENCIA") {
            const colegioDeActor = await this.assertColegioDeComite(actor.id);
            if (colegioDeActor !== colegioId) {
                throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
            }
        }

        return agregarNotaCaso(colegioId, solicitud.alertaColegioId, actor.id, texto, request);
    }
}
