/**
 * SPEC-236 (002-PI-mega-cola): repositorio DAL del motor de estados del
 * expediente padre. Frontera Q-3: TODO el acceso a Prisma del motor
 * (transiciones, tareas del worker, resolución de destinatarios y endpoint)
 * pasa por aquí; los módulos de src/lib/expediente/ y la API no importan
 * `@/lib/prisma`.
 *
 * Patrón del repo: cliente transaccional opcional (D2) y `withUnitOfWork`
 * para no anidar transacciones.
 */
import { EstadoExpediente } from "@prisma/client";
import type { AccionAudit, Expediente, Prisma, ScoreGravedad } from "@prisma/client";
import { prisma } from "../prisma.ts";
import { logAudit } from "@/lib/audit";
import type { DbClient } from "../unit-of-work";
import { withUnitOfWork } from "../unit-of-work";

const LIMITE_LOTE_DEFAULT = 100;

/** Payload de auditoría de una transición (mismo contrato que logAudit, sin tx). */
export interface AuditTransicionInput {
    accion: AccionAudit;
    tipoRecurso: string;
    recursoId: string;
    usuarioId?: string | undefined;
    valorAnterior?: string | undefined;
    valorNuevo?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
    metadatos?: Record<string, unknown> | undefined;
}

export interface TransicionEstadoInput {
    expedienteId: string;
    ahora: Date;
    /** Patch del estado destino (estado + fechaCierre/fechaEscalado/flag según corresponda). */
    data: Prisma.ExpedienteUpdateInput;
    audit: AuditTransicionInput;
}

export type ExpedienteConEventos = Prisma.ExpedienteGetPayload<{ include: { eventos: true } }>;

export class ExpedienteMotorRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Expediente por id (sin relaciones). */
    obtenerPorId(id: string): Promise<Expediente | null> {
        return this.db.expediente.findUnique({ where: { id } });
    }

    /** Titular del expediente (para autorización de reapertura por el padre). */
    async obtenerPadreUsuarioId(id: string): Promise<string | null> {
        const expediente = await this.db.expediente.findUnique({
            where: { id },
            select: { padreUsuarioId: true },
        });
        return expediente?.padreUsuarioId ?? null;
    }

    /**
     * Aplica la transición de estado en UNA transacción: bloquea la fila
     * (serializa transiciones concurrentes), actualiza el estado y registra
     * el AuditLog. La publicación a Motor Notif queda fuera (fail-open,
     * post-commit) por diseño del motor de notificaciones.
     */
    async transicionarEstado(input: TransicionEstadoInput): Promise<Expediente> {
        return withUnitOfWork(async (tx) => {
            await tx.expediente.update({
                where: { id: input.expedienteId },
                data: { updatedAt: input.ahora },
            });

            const actualizado = await tx.expediente.update({
                where: { id: input.expedienteId },
                data: input.data,
            });

            await logAudit({
                accion: input.audit.accion,
                tipoRecurso: input.audit.tipoRecurso,
                recursoId: input.audit.recursoId,
                usuarioId: input.audit.usuarioId,
                valorAnterior: input.audit.valorAnterior,
                valorNuevo: input.audit.valorNuevo,
                ipAddress: input.audit.ipAddress,
                userAgent: input.audit.userAgent,
                metadatos: input.audit.metadatos,
                tx,
            });

            return actualizado;
        });
    }

    /** Expedientes ACTIVO cuya última actividad es anterior al límite de inactividad. */
    listarActivosInactivos(limite: Date, take: number = LIMITE_LOTE_DEFAULT): Promise<Expediente[]> {
        const where: Prisma.ExpedienteWhereInput = {
            estado: EstadoExpediente.ACTIVO,
            OR: [{ ultimoEventoEn: { lt: limite } }, { ultimoEventoEn: null, fechaApertura: { lt: limite } }],
        };
        return this.db.expediente.findMany({ where, take });
    }

    /** Expedientes PENDIENTE_COMITE (vigilancia de SLA). */
    listarPendientesComite(take: number = LIMITE_LOTE_DEFAULT): Promise<Expediente[]> {
        const where: Prisma.ExpedienteWhereInput = { estado: EstadoExpediente.PENDIENTE_COMITE };
        return this.db.expediente.findMany({ where, take });
    }

    /** Último aviso de SLA vencido registrado para el expediente (idempotencia). */
    obtenerUltimoAvisoSla(expedienteId: string): Promise<{ creadoEn: Date } | null> {
        return this.db.auditLog.findFirst({
            where: { accion: "EXPEDIENTE_SLA_VENCIDO", recursoId: expedienteId },
            orderBy: { creadoEn: "desc" },
            select: { creadoEn: true },
        });
    }

    /** Expedientes no terminales con actividad desde `desde` (recálculo de gravedad 24h). */
    listarParaRecalculoGravedad(desde: Date, take: number = LIMITE_LOTE_DEFAULT): Promise<ExpedienteConEventos[]> {
        const where: Prisma.ExpedienteWhereInput = {
            estado: { notIn: [EstadoExpediente.CERRADO, EstadoExpediente.ESCALADO] },
            updatedAt: { gte: desde },
        };
        return this.db.expediente.findMany({
            where,
            include: { eventos: { orderBy: { ordenSecuencial: "asc" } } },
            take,
        });
    }

    /** Actualiza el score de gravedad vigente del expediente. */
    actualizarScoreGravedad(id: string, gravedad: ScoreGravedad): Promise<Expediente> {
        return this.db.expediente.update({
            where: { id },
            data: { scoreGravedadActual: gravedad },
        });
    }

    /** Expedientes CERRADO cuyo plazo de retención venció (fechaCierre, fallback createdAt). */
    listarCerradosParaRetencion(limite: Date, take: number = LIMITE_LOTE_DEFAULT): Promise<Expediente[]> {
        const where: Prisma.ExpedienteWhereInput = {
            estado: EstadoExpediente.CERRADO,
            OR: [{ fechaCierre: { lt: limite } }, { fechaCierre: null, createdAt: { lt: limite } }],
        };
        return this.db.expediente.findMany({ where, take });
    }

    /**
     * Purga de retención: sobrescribe los campos sensibles con `[retenido]`
     * en eventos e informes del expediente. NUNCA elimina filas. Devuelve los
     * conteos afectados (idempotente: campos ya `[retenido]` no se cuentan).
     */
    async purgarCamposSensibles(
        expedienteId: string,
        textoRetenido: string
    ): Promise<{ eventos: number; informes: number }> {
        const [eventosActualizados, informesActualizados] = await withUnitOfWork(async (tx) => {
            return Promise.all([
                tx.eventoExpediente.updateMany({
                    where: { expedienteId, texto: { not: textoRetenido } },
                    data: { texto: textoRetenido },
                }),
                tx.informeConsolidado.updateMany({
                    where: {
                        expedienteId,
                        OR: [{ resumenTextoGenerado: { not: textoRetenido } }, { pdfUrl: { not: textoRetenido } }],
                    },
                    data: { resumenTextoGenerado: textoRetenido, pdfUrl: textoRetenido },
                }),
            ]);
        });
        return { eventos: eventosActualizados.count, informes: informesActualizados.count };
    }

    /** Ids de miembros activos del comité de validación (destinatarios de eventos). */
    async listarIdsComiteValidacionActivo(take = 50): Promise<string[]> {
        const miembros = await this.db.usuario.findMany({
            where: { rol: "COMITE_VALIDACION", estado: "activo" },
            select: { id: true },
            take,
        });
        return miembros.map((m) => m.id);
    }

    // ── SPEC-239 (002-PI-mega-cola): escalación ROJO + SLA 12h + emergencia ──

    /**
     * Marca el expediente como escalado a ROJO: fija `scoreGravedadActual` en
     * ROJO y aplica los campos aditivos dados (estado compatible, SLA efectivo
     * y/o fecha de escalamiento). Solo actualiza campos permitidos (FR-003).
     */
    marcarEscaladoRojo(
        expedienteId: string,
        datos: {
            estado?: EstadoExpediente | undefined;
            slaEfectivoHoras?: number | undefined;
            fechaEscaladoRojoEn?: Date | undefined;
        }
    ): Promise<Expediente> {
        const data: Prisma.ExpedienteUpdateInput = { scoreGravedadActual: "ROJO" };
        if (datos.estado !== undefined) data.estado = datos.estado;
        if (datos.slaEfectivoHoras !== undefined) data.slaEfectivoHoras = datos.slaEfectivoHoras;
        if (datos.fechaEscaladoRojoEn !== undefined) data.fechaEscaladoRojoEn = datos.fechaEscaladoRojoEn;
        return this.db.expediente.update({ where: { id: expedienteId }, data });
    }

    /**
     * Expedientes ROJO en estados vigilados por el SLA 12h (FR-008) con fecha
     * de escalamiento registrada. El filtro de vencimiento se aplica en la
     * tarea (usa el parámetro vigente de horas).
     */
    listarRojosEnVigilanciaSla(take: number = LIMITE_LOTE_DEFAULT): Promise<Expediente[]> {
        const where: Prisma.ExpedienteWhereInput = {
            scoreGravedadActual: "ROJO",
            estado: { in: [EstadoExpediente.PENDIENTE_COMITE, EstadoExpediente.EN_APROBACION_PADRE] },
            fechaEscaladoRojoEn: { not: null },
        };
        return this.db.expediente.findMany({ where, take });
    }

    /** Último aviso de SLA ROJO vencido registrado para el expediente (idempotencia). */
    obtenerUltimoAvisoSlaRojo(expedienteId: string): Promise<{ creadoEn: Date } | null> {
        return this.db.auditLog.findFirst({
            where: { accion: "EXPEDIENTE_COMITE_SLA_VENCIDO", recursoId: expedienteId },
            orderBy: { creadoEn: "desc" },
            select: { creadoEn: true },
        });
    }

    /** Última activación de emergencia del expediente desde `desde` (ventana anti-doble). */
    obtenerUltimaActivacionEmergencia(
        expedienteId: string,
        desde: Date
    ): Promise<{ creadoEn: Date } | null> {
        return this.db.auditLog.findFirst({
            where: {
                accion: "EXPEDIENTE_EMERGENCIA_ACTIVADA",
                recursoId: expedienteId,
                creadoEn: { gte: desde },
            },
            orderBy: { creadoEn: "desc" },
            select: { creadoEn: true },
        });
    }

    /** Nombre visible del padre titular (variables de plantilla Motor Notif). */
    async obtenerNombrePadre(padreUsuarioId: string): Promise<string | null> {
        const padre = await this.db.usuario.findUnique({
            where: { id: padreUsuarioId },
            select: { nombre: true, email: true },
        });
        return padre ? (padre.nombre ?? padre.email) : null;
    }
}
