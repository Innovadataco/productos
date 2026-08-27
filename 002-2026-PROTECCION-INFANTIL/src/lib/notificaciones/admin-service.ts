/**
 * SPEC-202 (002-PI-099): servicios de admin para el motor de notificaciones.
 *
 * Agrupa la lógica de negocio de las pantallas:
 *   - Bandeja de envíos + reenvío manual
 *   - Editor de plantillas + preview
 *   - Editor de reglas + recálculo con auditoría
 *   - Parámetros del motor
 *   - Dashboard de salud
 *
 * Toda escritura pasa por los repositorios del DAL; este servicio nunca toca
 * `@/lib/prisma` directo (frontera DAL Q-3).
 */
import { CanalNotificacion, EstadoNotificacion, Prisma } from "@prisma/client";
import { NotificacionRepository } from "@/lib/dal/repositories/notificacion";
import { NotificacionPlantillaRepository } from "@/lib/dal/repositories/notificacion-plantilla";
import { NotificacionReglaRepository } from "@/lib/dal/repositories/notificacion-regla";
import { ParametroRepository } from "@/lib/dal/repositories/parametro";
import { ConfiguracionService } from "@/lib/dal/services/configuracion";
import { enviarEmailNotificacion } from "@/lib/notificaciones/enviar-email";
import { logAudit } from "@/lib/audit";
import { sendNotificacionEnvio } from "@/lib/queue";
import * as motor from "./motor";
import { renderizarPlantilla } from "./renderer";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { ParametroPatchInput } from "@/lib/dal/types/parametro";

const repoNotif = new NotificacionRepository();
const repoPlantilla = new NotificacionPlantillaRepository();
const repoRegla = new NotificacionReglaRepository();
const repoParam = new ParametroRepository();

const ESTADOS_NOTIFICACION = Object.values(EstadoNotificacion);
const CANALES_NOTIFICACION = Object.values(CanalNotificacion);

export type FiltroBandeja = {
    evento?: string | undefined;
    canal?: CanalNotificacion | undefined;
    estado?: EstadoNotificacion | undefined;
    destinatarioEmail?: string | undefined;
    fechaDesde?: string | undefined;
    fechaHasta?: string | undefined;
    page: number;
    pageSize: number;
};

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

function parseFechaBogotaUTC(fecha: string | undefined, finDeDia = false): Date | undefined {
    if (!fecha) return undefined;
    if (finDeDia) {
        return new Date(`${fecha}T23:59:59.999-05:00`);
    }
    return new Date(`${fecha}T00:00:00.000-05:00`);
}

export async function listarBandeja(filtros: FiltroBandeja) {
    return repoNotif.listarAdmin({
        evento: filtros.evento,
        canal: filtros.canal,
        estado: filtros.estado,
        destinatarioEmail: filtros.destinatarioEmail,
        fechaDesde: parseFechaBogotaUTC(filtros.fechaDesde),
        fechaHasta: parseFechaBogotaUTC(filtros.fechaHasta, true),
        page: filtros.page,
        pageSize: filtros.pageSize,
    });
}

export async function reenviarNotificacion(id: string) {
    const original = await repoNotif.findById(id);
    if (!original) {
        throw new AppError("Envío no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }
    if (!["ENVIADA", "ABIERTA", "CLICADA", "FALLIDA", "CANCELADA"].includes(original.estado)) {
        throw new AppError("Solo se pueden reenviar envíos finalizados", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const reenvio = await repoNotif.crear({
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
        console.warn(`[NotificacionesAdmin] No se pudo encolar reenvío ${reenvio.id}:`, err instanceof Error ? err.message : err);
    });

    return { id: reenvio.id };
}

export async function listarPlantillas() {
    return repoPlantilla.listarTodas();
}

export type PlantillaUpdateInput = {
    asunto?: string | undefined;
    cuerpoMarkdown?: string | undefined;
    variablesSchema?: Record<string, unknown> | undefined;
    activa?: boolean | undefined;
};

export async function actualizarPlantilla(clave: string, input: PlantillaUpdateInput, adminId: string) {
    const anterior = await repoPlantilla.findByClave(clave);
    if (!anterior) {
        throw new AppError("Plantilla no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }

    const actualizada = await repoPlantilla.actualizar(clave, {
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

function variablesDeMuestra(schema: Record<string, unknown> | null | undefined): Record<string, unknown> {
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

export async function enviarPreviewPlantilla(clave: string, adminEmail: string) {
    const plantilla = await repoPlantilla.findByClave(clave);
    if (!plantilla) {
        throw new AppError("Plantilla no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }

    const variables = variablesDeMuestra(plantilla.variablesSchema as Record<string, unknown>);
    const renderizado = renderizarPlantilla(plantilla.cuerpoMarkdown, plantilla.asunto, variables);

    await enviarEmailNotificacion(
        adminEmail,
        `[PREVIEW] ${renderizado.asunto ?? "Notificación de prueba"}`,
        renderizado.cuerpo
    );

    return { enviado: true };
}

export async function listarReglas(): Promise<ReglaAdminDto[]> {
    const reglas = await repoRegla.listarTodas();
    const conteos = await Promise.all(reglas.map((r) => repoNotif.contarProgramadasPorEvento(r.evento)));
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

export type ReglaUpdateInput = {
    offset?: string | undefined;
    canal?: CanalNotificacion | undefined;
    plantillaClave?: string | undefined;
    obligatoria?: boolean | undefined;
    activa?: boolean | undefined;
};

export async function actualizarRegla(
    id: string,
    input: ReglaUpdateInput,
    adminId: string,
    confirmRecalcular = false
) {
    const anterior = await repoRegla.findById(id);
    if (!anterior) {
        throw new AppError("Regla no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }

    const cambiaOffsetActiva =
        input.offset !== undefined && input.offset !== anterior.offset && anterior.activa;

    if (cambiaOffsetActiva && !confirmRecalcular) {
        const programadas = await repoNotif.contarProgramadasPorEvento(anterior.evento);
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

    const actualizada = await repoRegla.actualizar(id, {
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

export async function listarParametros() {
    return repoParam.findPorPrefijo("notificaciones.");
}

export async function actualizarParametro(clave: string, input: ParametroPatchInput, adminId: string) {
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

export async function obtenerSalud(): Promise<SaludMotorDto> {
    const ahora = new Date();
    const hace7d = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);

    const [encoladasListas, atrasadas, enviadas7d, entregadas7d, abiertas7d, errores24h, latenciaPromedioMs, paramIntervalo] =
        await Promise.all([
            repoNotif.contarEncoladasListas(),
            repoNotif.contarAtrasadas(15),
            repoNotif.contarPorEstadosYFecha(["ENVIADA", "ABIERTA", "CLICADA", "FALLIDA"], hace7d),
            repoNotif.contarPorEstadosYFecha(["ENVIADA", "ABIERTA", "CLICADA"], hace7d),
            repoNotif.contarPorEstadosYFecha(["ABIERTA", "CLICADA"], hace7d),
            repoNotif.contarPorEstadosYFecha(["FALLIDA"], hace24h),
            repoNotif.latenciaPromedioEnvio(hace24h),
            repoParam.findByClave("notificaciones.worker.intervalo_segundos"),
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

export function listarCatalogos() {
    return {
        estados: ESTADOS_NOTIFICACION,
        canales: CANALES_NOTIFICACION,
    };
}
