/**
 * SPEC-201 (BRIEF §7): API pública estricta del motor de notificaciones.
 *
 * Cualquier código de dominio (Pagos, Reportes, Casos, etc.) usa ESTA API y
 * nada más. Prohibido escribir en `Notificacion` desde fuera del módulo.
 */
import type { CanalNotificacion, Prisma } from "@prisma/client";
// SPEC-296 (002-PI-197): imports relativos. Este módulo es alcanzable desde
// scripts/worker-reportes.mjs vía email.ts (thin wrapper) → programar(),
// por lo que el ratchet anti-alias (SPEC-197 · I-88) lo obliga.
import { NotificacionRepository } from "../dal/repositories/notificacion";
import { NotificacionPlantillaRepository } from "../dal/repositories/notificacion-plantilla";
import { NotificacionReglaRepository } from "../dal/repositories/notificacion-regla";
import { NotificacionPreferenciaRepository } from "../dal/repositories/notificacion-preferencia";
import { UsuarioRepository } from "../dal/repositories/usuario";
import { aplicarOffset } from "./offset";
import { aplicarQuietHours } from "./quiet-hours";
import { sendNotificacionEnvio } from "../queue";
import { logger, LEVELS, type LogLevel } from "../logger";

/**
 * SPEC-302 (002-PI-208 · R-022 §1.3 punto c): nivel configurable propio del
 * motor, independiente de `LOG_LEVEL` global. `logger.*` sigue siendo la
 * salida real (mismo formato `[NIVEL]`); esto solo decide qué nivel se emite
 * desde este módulo, vía `LEVELS`/`LogLevel` ya exportados por `../logger`.
 */
function getMotorLogLevel(): LogLevel {
    const env = process.env.LOG_LEVEL_NOTIFICACIONES?.toLowerCase() as LogLevel | undefined;
    if (env && env in LEVELS) return env;
    return process.env.NODE_ENV === "production" ? "warn" : "info";
}

const motorLevel = getMotorLogLevel();

function logMotor(level: Exclude<LogLevel, "debug">, message: string, ...args: unknown[]) {
    if (LEVELS[level] < LEVELS[motorLevel]) return;
    logger[level](message, ...args);
}

export interface ProgramarInput {
    evento: string;
    sujetoTipo?: string | undefined;
    sujetoId?: string | undefined;
    destinatarios: Array<{
        usuarioId?: string | undefined;
        email?: string | undefined;
        // SPEC-333 (I-223): rol del destinatario para eventos con reglas de varios roles.
        // Opcional; si falta se resuelve de `usuarioId`. Los callers de eventos multi-rol
        // con destinatarios email-only (p. ej. representante legal) DEBEN pasarlo.
        rol?: string | undefined;
        variables: Record<string, unknown>;
    }>;
    enviarEn?: Date | undefined;
    metadatos?: Record<string, unknown> | undefined;
}

export interface ProgramarResult {
    programadas: number;
    canceladasPorReemplazo: number;
    /**
     * SPEC-418 (I-295): despachos a pg-boss que quedaron PENDIENTES porque se
     * programó dentro de una transacción.
     *
     * pg-boss corre por **otra conexión**: si se despachara adentro y la
     * transacción revirtiera, quedaría un job apuntando a una fila de
     * `Notificacion` que no existe. Se devuelven acá para llamar
     * `despacharEnvios()` DESPUÉS del commit.
     *
     * Y si ese despacho falla, **no se pierde nada**: la fila ya está
     * `ENCOLADA` en la base y el worker tiene polling de respaldo
     * (`worker-notificaciones.mjs`, "Polling de respaldo para reintentos y
     * jobs perdidos"). El despacho solo adelanta el envío; no lo condiciona.
     *
     * Sin `tx` viene vacío: el despacho va en línea, como siempre. Es opcional
     * en el tipo porque solo tiene sentido en el camino transaccional — los
     * llamadores de siempre no lo miran ni lo construyen.
     */
    envios?: EnvioPendiente[];
}

/** Un envío ya persistido que todavía no se le avisó al worker. */
export interface EnvioPendiente {
    notificacionId: string;
    enviarEn: Date;
}

export interface ProgramarOpciones {
    /**
     * SPEC-418 (I-295): programa DENTRO de la transacción del llamador, para
     * que el aviso y la decisión que lo origina se guarden o se pierdan juntos.
     * Nace del Verificador: la devolución al profesional se enviaba fuera de
     * transacción y con el error tragado — si el proveedor estaba caído, el
     * profesional nunca se enteraba y no quedaba rastro. El ciclo de admisión
     * se detenía en silencio.
     */
    tx?: Prisma.TransactionClient | undefined;
}

export interface CancelarInput {
    evento?: string | undefined;
    sujetoTipo?: string | undefined;
    sujetoId?: string | undefined;
    destinatarioUsuarioId?: string | undefined;
    soloProgramadas?: boolean | undefined;
}

export interface CancelarResult {
    canceladas: number;
}

export interface RecalcularInput {
    evento: string;
    motivo: string;
}

export interface RecalcularResult {
    recalculadas: number;
    reglaAnterior: unknown;
    reglaNueva: unknown;
}

const repoNotif = new NotificacionRepository();
const repoPlantilla = new NotificacionPlantillaRepository();
const repoRegla = new NotificacionReglaRepository();
const repoPref = new NotificacionPreferenciaRepository();
const repoUsuario = new UsuarioRepository();

/**
 * Los repositorios de esta corrida. Sin `tx` son los singletons de siempre
 * (cero cambio de conducta para los llamadores actuales); con `tx`, todos
 * escriben y leen dentro de la transacción del llamador.
 */
function reposDe(tx: Prisma.TransactionClient | undefined) {
    if (!tx) {
        return { repoNotif, repoPlantilla, repoRegla, repoPref, repoUsuario };
    }
    return {
        repoNotif: new NotificacionRepository(tx),
        repoPlantilla: new NotificacionPlantillaRepository(tx),
        repoRegla: new NotificacionReglaRepository(tx),
        repoPref: new NotificacionPreferenciaRepository(tx),
        repoUsuario: new UsuarioRepository(tx),
    };
}

async function resolverEmail(
    destinatario: ProgramarInput["destinatarios"][number],
    repo: UsuarioRepository
): Promise<string | null> {
    if (destinatario.email) return destinatario.email;
    if (destinatario.usuarioId) {
        const usuario = await repo.findEmailById(destinatario.usuarioId);
        return usuario?.email ?? null;
    }
    return null;
}

/**
 * SPEC-418: avisa al worker de los envíos que quedaron pendientes al programar
 * dentro de una transacción. Se llama DESPUÉS del commit.
 *
 * No lanza: un fallo acá solo significa que el envío esperará al próximo poll
 * del worker en vez de salir al instante. La fila ya está a salvo en la base —
 * que es justamente lo que I-295 no tenía.
 */
export async function despacharEnvios(envios: readonly EnvioPendiente[]): Promise<void> {
    for (const envio of envios) {
        await sendNotificacionEnvio(envio.notificacionId, envio.enviarEn).catch((err: unknown) => {
            logMotor(
                "warn",
                `[MotorNotificaciones] No se pudo encolar envío para notificación ${envio.notificacionId} (el polling lo recoge):`,
                err instanceof Error ? err.message : err
            );
        });
    }
}

/**
 * Programa notificaciones según las reglas activas del evento.
 * Reemplaza programaciones futuras duplicadas por (evento, sujeto, destinatario, canal).
 */
export async function programar(
    input: ProgramarInput,
    opciones: ProgramarOpciones = {}
): Promise<ProgramarResult> {
    const tx = opciones.tx;
    const repos = reposDe(tx);
    const reglas = await repos.repoRegla.findByEventoActivo(input.evento);
    if (reglas.length === 0) {
        logMotor("info", `[MotorNotificaciones] Sin reglas activas para evento=${input.evento}`);
        return { programadas: 0, canceladasPorReemplazo: 0, envios: [] };
    }

    const base = input.enviarEn ?? new Date();
    const envios: EnvioPendiente[] = [];
    let programadas = 0;
    let canceladasPorReemplazo = 0;

    // SPEC-333 (I-223): si el evento tiene reglas de MÁS DE UN rol, cada destinatario
    // recibe SOLO las de su rol (si no, se aplicarían reglas de otro rol → doble envío
    // en +0m y offset ajeno). Con un solo rol, `reglas` se usa tal cual: conducta idéntica
    // a la histórica (el motor sigue disparando por evento).
    const filtrarPorRol = new Set(reglas.map((r) => r.rol)).size > 1;

    for (const destinatario of input.destinatarios) {
        const email = await resolverEmail(destinatario, repos.repoUsuario);
        if (!email) {
            logMotor("warn", `[MotorNotificaciones] Destinatario sin email para evento=${input.evento}`);
            continue;
        }

        let reglasDestino = reglas;
        if (filtrarPorRol) {
            const rolEfectivo =
                destinatario.rol ??
                (destinatario.usuarioId ? (await repos.repoUsuario.findById(destinatario.usuarioId))?.rol : undefined);
            if (!rolEfectivo) {
                logMotor(
                    "warn",
                    `[MotorNotificaciones] evento multi-rol=${input.evento} sin rol de destinatario; se omite el destinatario`
                );
                continue;
            }
            reglasDestino = reglas.filter((r) => r.rol === rolEfectivo);
            if (reglasDestino.length === 0) {
                // Ese rol no tiene regla para el evento: no se aplica la de otro rol.
                continue;
            }
        }

        for (const regla of reglasDestino) {
            const eventoRegla = `${input.evento}.${regla.canal.toLowerCase()}`;
            // Sin usuarioId no hay preferencia de opt-out; la notificación es habilitada.
            const habilitada = destinatario.usuarioId
                ? await repos.repoPref.estaHabilitada(destinatario.usuarioId, eventoRegla, regla.obligatoria)
                : true;
            if (!habilitada) {
                logMotor(
                    "info",
                    `[MotorNotificaciones] omitida_por_preferencia evento=${input.evento} canal=${regla.canal} usuario=${destinatario.usuarioId}`
                );
                continue;
            }

            const plantilla = await repos.repoPlantilla.findByClaveYCanal(regla.plantillaClave, regla.canal);
            if (!plantilla) {
                logMotor(
                    "warn",
                    `[MotorNotificaciones] Plantilla no encontrada: clave=${regla.plantillaClave}, canal=${regla.canal}`
                );
                continue;
            }

            // Reemplazo: cancelar programaciones futuras duplicadas por
            // (evento, sujeto, destinatario, canal) para no pisar el otro canal.
            const reemplazo = await repos.repoNotif.cancelar({
                evento: input.evento,
                sujetoTipo: input.sujetoTipo,
                sujetoId: input.sujetoId,
                destinatarioUsuarioId: destinatario.usuarioId,
                canal: regla.canal,
                soloProgramadas: true,
                motivo: "reemplazo_programacion",
            });
            canceladasPorReemplazo += reemplazo.count;

            const conOffset = aplicarOffset(base, regla.offset);
            // SPEC-312 (I-165): pasar el canal para saltar la ventana en EMAIL/IN_APP.
            // La ventana queda en el default (undefined); leer el parámetro de BD en
            // el emisor es deuda diferida (ver specs/312 · tasks.md), irrelevante para
            // EMAIL/IN_APP que se saltan categóricamente por canal.
            const enviarEn = aplicarQuietHours(conOffset, undefined, regla.canal);

            const variables = {
                ...(input.metadatos ?? {}),
                ...destinatario.variables,
            } as Record<string, unknown>;

            const notificacion = await repos.repoNotif.crear({
                evento: input.evento,
                destinatarioUsuarioId: destinatario.usuarioId,
                destinatarioEmail: email,
                plantillaClave: plantilla.clave,
                canal: regla.canal,
                variables: variables as Prisma.InputJsonValue,
                sujetoTipo: input.sujetoTipo,
                sujetoId: input.sujetoId,
                enviarEn,
                estado: "ENCOLADA",
            });
            // Disparar el worker de envío en el momento programado (o inmediato).
            // SPEC-418: dentro de una transacción NO se despacha acá — pg-boss usa
            // otra conexión y un rollback dejaría un job huérfano. Se acumula y el
            // llamador despacha después del commit con `despacharEnvios()`.
            if (tx) {
                envios.push({ notificacionId: notificacion.id, enviarEn });
            } else {
                await despacharEnvios([{ notificacionId: notificacion.id, enviarEn }]);
            }
            programadas++;
        }
    }

    return { programadas, canceladasPorReemplazo, envios };
}

/**
 * Cancela notificaciones que coincidan con el criterio.
 * Por defecto solo cancela las programadas futuras (ENCOLADA + enviarEn > NOW).
 */
export async function cancelar(input: CancelarInput): Promise<CancelarResult> {
    const resultado = await repoNotif.cancelar({
        evento: input.evento,
        sujetoTipo: input.sujetoTipo,
        sujetoId: input.sujetoId,
        destinatarioUsuarioId: input.destinatarioUsuarioId,
        soloProgramadas: input.soloProgramadas ?? true,
        motivo: "cancelacion_manual",
    });
    return { canceladas: resultado.count };
}

/** Devuelve el estado de una notificación por id. */
export async function estado(id: string) {
    return repoNotif.findById(id);
}

/**
 * Recalcula programaciones futuras de un evento tras cambiar offsets de regla.
 * Cancela notificaciones ENCOLADA con enviarEn > NOW() (no toca enviadas).
 * Devuelve la regla actual como reglaNueva; reglaAnterior es null en SPEC-201
 * (no hay histórico de versiones de reglas todavía).
 */
export async function recalcular(input: RecalcularInput): Promise<RecalcularResult> {
    const regla = await repoRegla.findByEventoActivo(input.evento);
    const canceladas = await repoNotif.cancelar({
        evento: input.evento,
        soloProgramadas: true,
        motivo: "regla_cambiada_recalculo",
    });

    return {
        recalculadas: canceladas.count,
        reglaAnterior: null,
        reglaNueva: regla,
    };
}
