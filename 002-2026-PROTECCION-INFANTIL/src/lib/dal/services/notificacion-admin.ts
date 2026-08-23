/**
 * SPEC-202 (002-PI-099): servicio del panel admin del motor de notificaciones.
 * Centraliza la lógica de bandeja, plantillas, reglas, parámetros y salud del motor.
 * Toda lectura/escritura pasa por los repositorios del DAL (frontera Q-3).
 */
import { CanalNotificacion, EstadoNotificacion, Prisma } from "@prisma/client";
import { NotificacionRepository } from "@/lib/dal/repositories/notificacion";
import { NotificacionPlantillaRepository } from "@/lib/dal/repositories/notificacion-plantilla";
import { NotificacionReglaRepository } from "@/lib/dal/repositories/notificacion-regla";
import { ParametroRepository } from "@/lib/dal/repositories/parametro";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { ConfiguracionService } from "@/lib/dal/services/configuracion";
import { enviarEmailNotificacion } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { sendNotificacionEnvio } from "@/lib/queue";
import * as motor from "@/lib/notificaciones/motor";
import { renderizarPlantilla } from "@/lib/notificaciones/renderer";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { clampPage, clampPageSize } from "@/lib/pagination";
import { formatoFechaHoraBogota } from "@/lib/fechas/formato-bogota";
import type { ParametroPatchInput } from "@/lib/dal/types/parametro";

const PARAMETROS_NOTIFICACIONES = [
    "notificaciones.worker.intervalo_segundos",
    "notificaciones.worker.max_intentos",
    "notificaciones.worker.backoff_segundos",
    "notificaciones.worker.lote_size",
    "notificaciones.retencion_meses",
    "notificaciones.horario.silencio",
    "notificaciones.bounces.umbral_bloqueo",
];

export interface FiltrosBandeja {
    evento?: string | undefined;
    canal?: CanalNotificacion | undefined;
    estado?: EstadoNotificacion | undefined;
    destinatarioEmail?: string | undefined;
    fechaDesde?: string | undefined;
    fechaHasta?: string | undefined;
    page: number;
    pageSize: number;
}

export interface BandejaResult {
    items: Array<{
        id: string;
        evento: string;
        destinatarioEmail: string;
        canal: CanalNotificacion;
        estado: EstadoNotificacion;
        enviarEn: string | null;
        sentAt: string | null;
        openedAt: string | null;
        clickedAt: string | null;
        bouncedAt: string | null;
        plantillaClave: string;
        intentos: number;
        ultimoError: string | null;
        createdAt: string;
    }>;
    page: number;
    pageSize: number;
    total: number;
}

export type ReglaAdminDto = {
    id: string;
    evento: string;
    rol: string;
    offset: string;
    canal: CanalNotificacion;
    plantillaClave: string;
    obligatoria: boolean;
    activa: boolean;
    programadas: number;
    createdAt: string;
    actualizadaEn: string;
};

export type SaludMotorDto = {
    colaActual: number;
    atrasadas: number;
    tasaEntrega7d: number | null;
    tasaApertura7d: number | null;
    errores24h: number;
    latenciaPromedioMs: number | null;
    enviadas7d: number;
    intervaloSegundos: number;
};

export class NotificacionAdminService {
    constructor(
        private readonly repoNotif = new NotificacionRepository(),
        private readonly repoPlantilla = new NotificacionPlantillaRepository(),
        private readonly repoRegla = new NotificacionReglaRepository(),
        private readonly repoParam = new ParametroRepository(),
        private readonly repoUsuario = new UsuarioRepository()
    ) {}

    private formatDate(d: Date | null): string | null {
        return d ? formatoFechaHoraBogota(d, { dateStyle: "short", timeStyle: "medium" }) : null;
    }

    async listarBandeja(filtros: FiltrosBandeja): Promise<BandejaResult> {
        const page = clampPage(filtros.page);
        const pageSize = clampPageSize(filtros.pageSize);
        const skip = (page - 1) * pageSize;

        const where: Prisma.NotificacionWhereInput = {};
        if (filtros.evento) where.evento = { contains: filtros.evento, mode: "insensitive" };
        if (filtros.canal) where.canal = filtros.canal;
        if (filtros.estado) where.estado = filtros.estado;
        if (filtros.destinatarioEmail) {
            where.destinatarioEmail = { contains: filtros.destinatarioEmail, mode: "insensitive" };
        }
        if (filtros.fechaDesde || filtros.fechaHasta) {
            where.createdAt = {};
            if (filtros.fechaDesde) {
                where.createdAt.gte = new Date(`${filtros.fechaDesde}T00:00:00.000-05:00`);
            }
            if (filtros.fechaHasta) {
                where.createdAt.lte = new Date(`${filtros.fechaHasta}T23:59:59.999-05:00`);
            }
        }

        const [items, total] = await this.repoNotif.findPaginadas(where, { skip, take: pageSize });

        return {
            items: items.map((n) => ({
                id: n.id,
                evento: n.evento,
                destinatarioEmail: n.destinatarioEmail,
                canal: n.canal,
                estado: n.estado,
                enviarEn: this.formatDate(n.enviarEn),
                sentAt: this.formatDate(n.sentAt),
                openedAt: this.formatDate(n.openedAt),
                clickedAt: this.formatDate(n.clickedAt),
                bouncedAt: this.formatDate(n.bouncedAt),
                plantillaClave: n.plantillaClave,
                intentos: n.intentos,
                ultimoError: n.ultimoError,
                createdAt: this.formatDate(n.createdAt) ?? n.createdAt.toISOString(),
            })),
            page,
            pageSize,
            total,
        };
    }

    async reenviarNotificacion(id: string): Promise<{ id: string }> {
        const original = await this.repoNotif.findById(id);
        if (!original) {
            throw new AppError("Envío no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        if (!["ENVIADA", "ABIERTA", "CLICADA", "FALLIDA", "CANCELADA"].includes(original.estado)) {
            throw new AppError("Solo se pueden reenviar envíos finalizados", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const reenvio = await this.repoNotif.crear({
            evento: original.evento,
            destinatarioUsuarioId: original.destinatarioUsuarioId,
            destinatarioEmail: original.destinatarioEmail,
            plantillaClave: original.plantillaClave,
            canal: original.canal,
            variables: original.variables as Prisma.InputJsonValue,
            sujetoTipo: original.sujetoTipo,
            sujetoId: original.sujetoId,
            enviarEn: new Date(),
            estado: "ENCOLADA",
        });

        await sendNotificacionEnvio(reenvio.id).catch((err: unknown) => {
            console.warn(
                `[NotificacionesAdmin] No se pudo encolar reenvío ${reenvio.id}:`,
                err instanceof Error ? err.message : err
            );
        });

        return { id: reenvio.id };
    }

    async listarPlantillas() {
        return this.repoPlantilla.listarTodas();
    }

    async obtenerPlantilla(clave: string) {
        return this.repoPlantilla.findByClave(clave);
    }

    async actualizarPlantilla(
        clave: string,
        input: {
            asunto?: string | undefined;
            cuerpoMarkdown?: string | undefined;
            variablesSchema?: Record<string, unknown> | undefined;
            activa?: boolean | undefined;
        },
        adminId: string
    ) {
        const anterior = await this.repoPlantilla.findByClave(clave);
        if (!anterior) {
            throw new AppError("Plantilla no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        const actualizada = await this.repoPlantilla.actualizar(clave, {
            ...(input.asunto !== undefined ? { asunto: input.asunto } : {}),
            ...(input.cuerpoMarkdown !== undefined ? { cuerpoMarkdown: input.cuerpoMarkdown } : {}),
            ...(input.variablesSchema !== undefined ? { variablesSchema: input.variablesSchema as never } : {}),
            ...(input.activa !== undefined ? { activa: input.activa } : {}),
            actualizadaPor: adminId,
        });

        await logAudit({
            accion: "NOTIFICACION_PLANTILLA_ACTUALIZADA",
            tipoRecurso: "NotificacionPlantilla",
            recursoId: actualizada.id,
            usuarioId: adminId,
            valorAnterior: JSON.stringify({
                asunto: anterior.asunto,
                cuerpoMarkdown: anterior.cuerpoMarkdown,
                variablesSchema: anterior.variablesSchema,
                activa: anterior.activa,
            }),
            valorNuevo: JSON.stringify({
                asunto: actualizada.asunto,
                cuerpoMarkdown: actualizada.cuerpoMarkdown,
                variablesSchema: actualizada.variablesSchema,
                activa: actualizada.activa,
            }),
        });

        return actualizada;
    }

    private variablesDeMuestra(schema: Record<string, unknown> | null | undefined): Record<string, unknown> {
        const variables: Record<string, unknown> = {
            nombre: "Ana",
            fecha: "2026-08-22",
            hora: "09:00",
            importe: "$49.900",
            plan: "Protección Infantil Mensual",
            colegio: "Colegio de prueba",
            email: "admin@example.com",
        };
        if (!schema || typeof schema !== "object") return variables;

        const props = (schema.properties ?? schema) as Record<string, unknown>;
        for (const [clave, def] of Object.entries(props)) {
            if (variables[clave] !== undefined) continue;
            const tipo = typeof def === "object" && def !== null ? (def as { type?: string }).type : undefined;
            variables[clave] = tipo === "number" ? 1 : tipo === "boolean" ? true : `{{${clave}}}`;
        }
        return variables;
    }

    async enviarPreviewPlantilla(clave: string, adminEmail: string, variablesExternas?: Record<string, unknown>) {
        const plantilla = await this.repoPlantilla.findByClave(clave);
        if (!plantilla) {
            throw new AppError("Plantilla no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }
        if (plantilla.canal !== "EMAIL") {
            throw new AppError("Solo se puede enviar preview de plantillas de email", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const variables = variablesExternas ?? this.variablesDeMuestra(plantilla.variablesSchema as Record<string, unknown>);
        const renderizado = renderizarPlantilla(plantilla.cuerpoMarkdown, plantilla.asunto, variables);

        const { id: proveedorId } = await enviarEmailNotificacion(
            adminEmail,
            `[PREVIEW] ${renderizado.asunto ?? "Notificación de prueba"}`,
            renderizado.cuerpo
        );

        return { enviado: true, proveedorId };
    }

    async listarReglas(): Promise<ReglaAdminDto[]> {
        const reglas = await this.repoRegla.listarTodas();
        const conteos = await Promise.all(reglas.map((r) => this.repoNotif.contarProgramadasPorEvento(r.evento)));
        return reglas.map((r, idx) => ({
            id: r.id,
            evento: r.evento,
            rol: r.rol,
            offset: r.offset,
            canal: r.canal,
            plantillaClave: r.plantillaClave,
            obligatoria: r.obligatoria,
            activa: r.activa,
            programadas: conteos[idx],
            createdAt: r.createdAt.toISOString(),
            actualizadaEn: r.actualizadaEn.toISOString(),
        }));
    }

    async obtenerRegla(id: string) {
        return this.repoRegla.findById(id);
    }

    async actualizarRegla(
        id: string,
        input: {
            offset?: string | undefined;
            canal?: CanalNotificacion | undefined;
            plantillaClave?: string | undefined;
            obligatoria?: boolean | undefined;
            activa?: boolean | undefined;
        },
        adminId: string,
        confirmRecalcular = false
    ) {
        const anterior = await this.repoRegla.findById(id);
        if (!anterior) {
            throw new AppError("Regla no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        const cambiaOffsetActiva =
            input.offset !== undefined && input.offset !== anterior.offset && anterior.activa;

        if (cambiaOffsetActiva && !confirmRecalcular) {
            const programadas = await this.repoNotif.contarProgramadasPorEvento(anterior.evento);
            return {
                requiereConfirmacion: true,
                programadas,
                evento: anterior.evento,
            } as const;
        }

        let recalculadas = 0;
        if (cambiaOffsetActiva) {
            const resultado = await motor.recalcular({ evento: anterior.evento, motivo: "cambio_offset_regla" });
            recalculadas = resultado.recalculadas;
        }

        const actualizada = await this.repoRegla.actualizar(id, {
            ...(input.offset !== undefined ? { offset: input.offset } : {}),
            ...(input.canal !== undefined ? { canal: input.canal } : {}),
            ...(input.plantillaClave !== undefined ? { plantillaClave: input.plantillaClave } : {}),
            ...(input.obligatoria !== undefined ? { obligatoria: input.obligatoria } : {}),
            ...(input.activa !== undefined ? { activa: input.activa } : {}),
            actualizadaPor: adminId,
        });

        await logAudit({
            accion: "NOTIFICACION_REGLA_ACTUALIZADA",
            tipoRecurso: "NotificacionRegla",
            recursoId: actualizada.id,
            usuarioId: adminId,
            valorAnterior: JSON.stringify({
                offset: anterior.offset,
                canal: anterior.canal,
                plantillaClave: anterior.plantillaClave,
                obligatoria: anterior.obligatoria,
                activa: anterior.activa,
            }),
            valorNuevo: JSON.stringify({
                offset: actualizada.offset,
                canal: actualizada.canal,
                plantillaClave: actualizada.plantillaClave,
                obligatoria: actualizada.obligatoria,
                activa: actualizada.activa,
            }),
            metadatos: { recalculadas, evento: anterior.evento },
        });

        return { ...actualizada, recalculadas };
    }

    async contarProgramadasParaRecalcular(evento: string): Promise<number> {
        return this.repoNotif.contarProgramadasPorEvento(evento, new Date());
    }

    async recalcularEvento(evento: string, motivo: string) {
        return motor.recalcular({ evento, motivo });
    }

    async listarParametros() {
        return this.repoParam.findPorClaves(PARAMETROS_NOTIFICACIONES);
    }

    async actualizarParametro(clave: string, input: ParametroPatchInput, adminId: string) {
        const param = await new ConfiguracionService().actualizar(clave, input, adminId);
        await logAudit({
            accion: "NOTIFICACION_PARAMETRO_ACTUALIZADO",
            tipoRecurso: "ParametroSistema",
            recursoId: param.id,
            usuarioId: adminId,
            valorAnterior: JSON.stringify({ valor: input.valor }),
            valorNuevo: JSON.stringify({ valor: param.valor }),
        });
        return param;
    }

    async obtenerSalud(): Promise<SaludMotorDto> {
        const ahora = new Date();
        const hace7d = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
        const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);

        const [encoladasListas, atrasadas, enviadas7d, entregadas7d, abiertas7d, errores24h, latenciaPromedioMs, paramIntervalo] =
            await Promise.all([
                this.repoNotif.contarEncoladasListas(ahora),
                this.repoNotif.contarAtrasadas(ahora, 15),
                this.repoNotif.contarPorEstadosYFecha(["ENVIADA", "ABIERTA", "CLICADA", "FALLIDA"], hace7d),
                this.repoNotif.contarPorEstadosYFecha(["ENVIADA", "ABIERTA", "CLICADA"], hace7d),
                this.repoNotif.contarPorEstadosYFecha(["ABIERTA", "CLICADA"], hace7d),
                this.repoNotif.contarPorEstadosYFecha(["FALLIDA"], hace24h),
                this.repoNotif.latenciaPromedioEnvio(hace24h),
                this.repoParam.findByClave("notificaciones.worker.intervalo_segundos"),
            ]);

        const tasaEntrega7d = enviadas7d > 0 ? Math.round((entregadas7d / enviadas7d) * 1000) / 1000 : null;
        const tasaApertura7d = entregadas7d > 0 ? Math.round((abiertas7d / entregadas7d) * 1000) / 1000 : null;
        const intervaloSegundos = parseInt(paramIntervalo?.valor ?? "10", 10) || 10;

        return {
            colaActual: encoladasListas,
            atrasadas,
            tasaEntrega7d,
            tasaApertura7d,
            errores24h,
            latenciaPromedioMs,
            enviadas7d,
            intervaloSegundos,
        };
    }

    listarCatalogos() {
        return {
            estados: Object.values(EstadoNotificacion),
            canales: Object.values(CanalNotificacion),
        };
    }

    async findAdminEmail(adminId: string): Promise<string | null> {
        const usuario = await this.repoUsuario.findById(adminId);
        return usuario?.email ?? null;
    }
}

export { PARAMETROS_NOTIFICACIONES };
