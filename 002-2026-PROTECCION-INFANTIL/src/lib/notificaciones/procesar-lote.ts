/**
 * SPEC-292 (002-PI-192 · cierra I-147) — Extracción del ciclo de procesamiento
 * de notificaciones del worker a un módulo puro testeable.
 *
 * El worker `scripts/worker-notificaciones.mjs` importa `procesarLote` desde
 * aquí. La lógica es idéntica a la versión previa (línea 138-234 del worker)
 * pero con:
 *   - dependencias inyectables (repos + enviarEmail + logger) para test
 *   - log observable cuando `pendientes.length === 0` (SPEC-292 FR-002)
 *
 * Cero cambios semánticos. El bug I-147 se resolvía QUITANDO el `.unref()` del
 * timer del worker (fuera de este módulo).
 */
import type { NotificacionRepository } from "@/lib/dal/repositories/notificacion";
import type { NotificacionPlantillaRepository } from "@/lib/dal/repositories/notificacion-plantilla";
import { renderizarPlantilla } from "@/lib/notificaciones/renderer";
import { aplicarQuietHours } from "@/lib/notificaciones/quiet-hours";
import { registrarBounce, emailBloqueado } from "@/lib/notificaciones/bounces";

// El worker `.mjs` importa este servicio via tsx; conservar los tipos como
// forma abstracta permite mockear en el test integración.
export interface ConfigProcesarLote {
    quietHours: string;
    maxIntentos: number;
    backoffSegundos: number[];
    loteSize: number;
}

export interface DependenciasProcesarLote {
    repoNotif: NotificacionRepository;
    repoPlantilla: NotificacionPlantillaRepository;
    enviarEmail: (
        destinatario: string,
        asunto: string,
        cuerpo: string,
    ) => Promise<{ id: string }>;
    logger?: {
        info: (msg: string, meta?: Record<string, unknown>) => void;
        warn: (msg: string, meta?: Record<string, unknown>) => void;
    };
    // Fecha "ahora" inyectable para tests deterministas.
    ahora?: () => Date;
}

export type AccionResultado =
    | "diferida_quiet_hours"
    | "cancelada_por_bloqueo"
    | "fallida_sin_plantilla"
    | "enviada_email"
    | "enviada_in_app"
    | "canal_desconocido"
    | "fallida_final"
    | "reintentando";

export interface ResultadoNotificacion {
    accion: AccionResultado;
    proveedorId?: string;
}

function calcularBackoff(intentos: number, backoffSegundos: number[]): Date {
    const idx = Math.min(intentos, backoffSegundos.length) - 1;
    const segundos =
        backoffSegundos[Math.max(0, idx)] ?? backoffSegundos[backoffSegundos.length - 1] ?? 60;
    return new Date(Date.now() + segundos * 1000);
}

interface NotificacionParaEnvio {
    id: string;
    enviarEn: Date | null;
    canal: string;
    destinatarioEmail: string;
    plantillaClave: string;
    variables: unknown;
    intentos: number;
}

export async function procesarNotificacion(
    notificacion: NotificacionParaEnvio,
    config: ConfigProcesarLote,
    deps: DependenciasProcesarLote,
): Promise<ResultadoNotificacion> {
    const ahora = deps.ahora ? deps.ahora() : new Date();

    // Quiet hours: si la notificación fue programada dentro de la ventana de
    // silencio, el motor ya debería haberla diferido al programar. Este segundo
    // chequeo protege contra cambios de regla/parámetro en caliente.
    if (
        notificacion.enviarEn &&
        // SPEC-312 (I-165): pasar el canal para saltar la ventana en EMAIL/IN_APP.
        aplicarQuietHours(notificacion.enviarEn, config.quietHours, notificacion.canal).getTime() > ahora.getTime()
    ) {
        return { accion: "diferida_quiet_hours" };
    }

    if (notificacion.canal === "EMAIL") {
        if (await emailBloqueado(notificacion.destinatarioEmail)) {
            await deps.repoNotif.marcarCancelada(notificacion.id, "contacto_bloqueado");
            return { accion: "cancelada_por_bloqueo" };
        }
    }

    const plantilla = await deps.repoPlantilla.findByClaveYCanal(
        notificacion.plantillaClave,
        notificacion.canal as never,
    );
    if (!plantilla) {
        await deps.repoNotif.marcarFallida(notificacion.id, "Plantilla no encontrada");
        return { accion: "fallida_sin_plantilla" };
    }

    await deps.repoNotif.marcarEnviando(notificacion.id);

    try {
        if (notificacion.canal === "EMAIL") {
            const variables = (notificacion.variables ?? {}) as Record<string, string | number>;
            const renderizado = renderizarPlantilla(
                plantilla.cuerpoMarkdown,
                plantilla.asunto,
                variables,
            );
            const { id: proveedorId } = await deps.enviarEmail(
                notificacion.destinatarioEmail,
                renderizado.asunto ?? "Notificación",
                renderizado.cuerpo,
            );
            await deps.repoNotif.marcarEnviada(notificacion.id, proveedorId);
            return { accion: "enviada_email", proveedorId };
        }

        if (notificacion.canal === "IN_APP") {
            await deps.repoNotif.marcarEnviada(notificacion.id);
            return { accion: "enviada_in_app" };
        }

        return { accion: "canal_desconocido" };
    } catch (err) {
        const mensaje = err instanceof Error ? err.message : "Error desconocido";
        console.error(
            `[PI-NOTIFICACIONES] Error enviando notificación ${notificacion.id}: ${mensaje}`,
        );

        // Detectar bounces sintéticos (la mayoría son asíncronos vía webhook).
        const esBounce = /bounce|rejected|invalid|hard.?bounce/i.test(mensaje);
        if (esBounce) {
            await registrarBounce(notificacion.destinatarioEmail, "hard_bounce");
        }

        const nuevoIntento = notificacion.intentos + 1;
        if (nuevoIntento >= config.maxIntentos) {
            // SPEC-292: delega en el DAL (Q-3) — antes usaba prisma directo.
            await deps.repoNotif.marcarFallidaDefinitiva(notificacion.id, nuevoIntento, mensaje);
            return { accion: "fallida_final" };
        }

        const proximoIntento = calcularBackoff(nuevoIntento, config.backoffSegundos);
        await deps.repoNotif.marcarFallida(notificacion.id, mensaje, proximoIntento);
        return { accion: "reintentando" };
    }
}

/**
 * Ciclo principal de polling. Consulta pendientes y las procesa en orden.
 *
 * SPEC-292: si `pendientes.length === 0` logea `poll: 0 pendientes` para
 * dejar rastro de que el worker sí está corriendo (bug I-147 quedó invisible
 * porque el silencio total no distinguía "no hay trabajo" de "polling roto").
 */
export async function procesarLote(
    deps: DependenciasProcesarLote,
    config: ConfigProcesarLote,
): Promise<{ procesadas: number }> {
    const ahora = deps.ahora ? deps.ahora() : new Date();

    const pendientes = await deps.repoNotif.listarPendientesParaEnvio(ahora, config.loteSize);
    if (pendientes.length === 0) {
        // SPEC-292 FR-002: rastro de tick vacío.
        console.log("[PI-NOTIFICACIONES] poll: 0 pendientes");
        return { procesadas: 0 };
    }

    if (deps.logger) {
        deps.logger.info("Procesando lote de notificaciones", { pendientes: pendientes.length });
    } else {
        console.log(`[PI-NOTIFICACIONES] Procesando lote: ${pendientes.length} pendientes`);
    }

    let procesadas = 0;
    for (const notificacion of pendientes) {
        try {
            await procesarNotificacion(notificacion as NotificacionParaEnvio, config, deps);
            procesadas++;
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : "Error desconocido";
            console.error(
                `[PI-NOTIFICACIONES] Error crítico procesando notificación ${notificacion.id}: ${mensaje}`,
            );
            await deps.repoNotif.marcarFallida(notificacion.id, mensaje);
        }
    }

    if (deps.logger) {
        deps.logger.info("Lote procesado", { procesadas });
    } else {
        console.log(`[PI-NOTIFICACIONES] Lote procesado: ${procesadas}`);
    }
    return { procesadas };
}
