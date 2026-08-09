/**
 * SPEC-149 (FR-002/003/004) — Pipeline de avisos por email del colegio.
 *
 * Flujo de un evento (reporte nuevo, umbral por curso, estudiante repetido):
 *   registrarEventoAviso (hook inline, NUNCA envía: solo decide y ENCOLA)
 *     → preferencia efectiva (sin fila = defaults) → global gate → idempotencia
 *     → tope diario (PENDIENTE_DIGEST) → job pg-boss `colegio-aviso`
 *   procesarEnvioAviso (handler del worker)
 *     → re-verifica preferencia/idempotencia/tope → resuelve destino
 *     → envía (email.ts) → ENVIADO solo tras el 200 del proveedor
 *     → fallo: FALLIDO + throw (pg-boss reintenta; FALLIDO no consume la
 *       idempotencia — la constraint es por clave y la fila se ACTUALIZA).
 *
 * La idempotencia REAL vive en la constraint
 * @@unique([colegioId, tipoEvento, entidadId, dia]) de RegistroAvisoColegio:
 * el mismo evento/entidad/día produce UNA fila y UN email como máximo.
 * Cero PII: los emails (email.ts) llevan solo conteos; nada de esto incluye
 * texto del reporte, identificadores, nombres ni scores (I-28/I-29).
 */
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { getParametroSistemaValor } from "@/lib/parametros";
import { sendAvisoColegio } from "@/lib/queue";
import {
    enviarAvisoReporteNuevoColegio,
    enviarAvisoUmbralCursoColegio,
    enviarAvisoEstudianteRepetidoColegio,
} from "@/lib/email";
import { AlertaColegioRepository } from "@/lib/dal/repositories/alerta-colegio";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { PreferenciaAlertaColegioRepository } from "@/lib/dal/repositories/preferencia-alerta-colegio";
import type { TipoEventoAvisoColegio } from "@/lib/dal/repositories/preferencia-alerta-colegio";
import { RegistroAvisoColegioRepository } from "@/lib/dal/repositories/registro-aviso-colegio";
import { EstudianteObservacionRepository } from "@/lib/dal/repositories/estudiante-observacion";

/** Defaults cuando el colegio no tiene fila de preferencia (spec: todo habilitado). */
export const DEFAULTS_AVISO = {
    REPORTE_NUEVO: { habilitado: true },
    UMBRAL_CURSO: { habilitado: true, umbral: 3, ventanaDias: 7 },
    ESTUDIANTE_REPETIDO: { habilitado: true, umbral: 2, ventanaDias: 30 },
    RESUMEN_SEMANAL: { habilitado: true },
} as const;

const TOPE_DIARIO_DEFAULT = 5;
const DIA_MS = 24 * 60 * 60 * 1000;

export interface PreferenciaEfectiva {
    habilitado: boolean;
    emailDestino: string | null;
    umbral: number;
    ventanaDias: number;
}

/** Día calendario en America/Bogota (UTC-5 sin DST) como Date UTC a medianoche. */
export function diaBogota(fecha: Date = new Date()): Date {
    const iso = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(fecha);
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, d!));
}

/** Lunes (00:00 UTC del día Bogotá) de la semana de `fecha` — clave del resumen semanal. */
export function inicioSemanaBogota(fecha: Date = new Date()): Date {
    const dia = diaBogota(fecha);
    const desplazamiento = (dia.getUTCDay() + 6) % 7; // lunes = 0
    return new Date(dia.getTime() - desplazamiento * DIA_MS);
}

/** Preferencia efectiva del colegio para un tipo: fila propia o defaults de la spec. */
export async function obtenerPreferenciaEfectiva(
    colegioId: string,
    tipoEvento: TipoEventoAvisoColegio
): Promise<PreferenciaEfectiva> {
    const fila = await new PreferenciaAlertaColegioRepository().obtenerPorTipo(colegioId, tipoEvento);
    const defaults = DEFAULTS_AVISO[tipoEvento];
    return {
        habilitado: fila?.habilitado ?? defaults.habilitado,
        emailDestino: fila?.emailDestino ?? null,
        umbral: fila?.umbral ?? ("umbral" in defaults ? defaults.umbral : 0),
        ventanaDias: fila?.ventanaDias ?? ("ventanaDias" in defaults ? defaults.ventanaDias : 0),
    };
}

/** Interruptor global del canal (parámetro seedeado; ausente = habilitado). */
async function avisosGlobalmenteHabilitados(): Promise<boolean> {
    const valor = await getParametroSistemaValor("colegio.notificaciones.enabled");
    return valor !== "false";
}

/** Tope diario de emails de aviso por colegio (parámetro, default 5). */
export async function obtenerTopeDiario(): Promise<number> {
    const valor = parseInt((await getParametroSistemaValor("colegio.avisos.tope_diario")) || "", 10);
    return Number.isNaN(valor) || valor < 1 ? TOPE_DIARIO_DEFAULT : valor;
}

/** Destino del aviso: emailDestino de la preferencia o, por default, el SCHOOL_ADMIN. */
export async function resolverEmailDestino(colegioId: string, emailDestinoPref: string | null): Promise<string | null> {
    if (emailDestinoPref) return emailDestinoPref;
    const admin = await new UsuarioRepository().findAdminColegioParaNotificacion(colegioId);
    return admin?.email ?? null;
}

export interface ResultadoRegistroEvento {
    encolado: boolean;
    motivo: "encolado" | "omitido_preferencia" | "omitido_global" | "duplicado" | "pendiente_digest";
}

/**
 * Evalúa un evento y, si corresponde, ENCOLA el job `colegio-aviso` (nunca
 * envía inline — el hook responde sin bloquear). Registra OMITIDO /
 * PENDIENTE_DIGEST en la bitácora para que la decisión sea auditable.
 */
export async function registrarEventoAviso(params: {
    colegioId: string;
    tipoEvento: TipoEventoAvisoColegio;
    entidadId: string;
    ahora?: Date;
    /** SPEC-150: nota auditable que queda en el registro (p. ej. "observación especial"). */
    detalle?: string;
}): Promise<ResultadoRegistroEvento> {
    const { colegioId, tipoEvento, entidadId } = params;
    const ahora = params.ahora ?? new Date();
    const dia = diaBogota(ahora);
    const registros = new RegistroAvisoColegioRepository();
    const clave = { colegioId, tipoEvento, entidadId, dia };

    // Idempotencia temprana: fila existente en estado final ≡ ya procesado hoy.
    // FALLIDO no bloquea: el evento merece otro intento (pg-boss o re-proceso).
    const existente = await registros.buscar(clave);
    if (existente && existente.estado !== "FALLIDO") {
        return { encolado: false, motivo: "duplicado" };
    }

    if (!(await avisosGlobalmenteHabilitados())) {
        await registros.registrarSiAusente(clave, "OMITIDO", "colegio.notificaciones.enabled=false");
        return { encolado: false, motivo: "omitido_global" };
    }

    const pref = await obtenerPreferenciaEfectiva(colegioId, tipoEvento);
    if (!pref.habilitado) {
        await registros.registrarSiAusente(clave, "OMITIDO", "aviso deshabilitado por el colegio");
        return { encolado: false, motivo: "omitido_preferencia" };
    }

    // Tope diario: alcanzado ⇒ el evento NO se pierde, queda para el próximo resumen.
    const enviadosHoy = await registros.contarEnviadosDelDia(colegioId, dia);
    const tope = await obtenerTopeDiario();
    if (enviadosHoy >= tope) {
        await registros.registrarSiAusente(clave, "PENDIENTE_DIGEST", `tope diario alcanzado (${tope})`);
        logger.info(`[COLEGIO/AVISOS] Tope diario (${tope}) alcanzado para colegio ${colegioId}: ${tipoEvento} queda PENDIENTE_DIGEST`);
        return { encolado: false, motivo: "pendiente_digest" };
    }

    const jobId = await sendAvisoColegio({
        colegioId,
        tipoEvento,
        entidadId,
        dia: dia.toISOString().slice(0, 10),
        ...(params.detalle ? { detalle: params.detalle } : {}),
    });
    logger.info(`[COLEGIO/AVISOS] Evento ${tipoEvento} encolado para colegio ${colegioId} (entidad=${entidadId}, job=${jobId ?? "n/a"})`);
    return { encolado: true, motivo: "encolado" };
}

/**
 * Handler del job `colegio-aviso` (worker). Re-verifica TODO (la preferencia
 * pudo cambiar entre el encolado y la corrida) y envía UNA vez: ENVIADO se
 * marca solo tras el 200 del proveedor. Un fallo marca FALLIDO y relanza para
 * que pg-boss reintente — la fila FALLIDO se actualiza a ENVIADO en el éxito,
 * nunca crea una segunda (misma clave de idempotencia).
 */
export async function procesarEnvioAviso(job: {
    colegioId: string;
    tipoEvento: TipoEventoAvisoColegio;
    entidadId: string;
    dia: string;
    /** SPEC-150: nota auditable que queda en el registro ENVIADO. */
    detalle?: string;
}): Promise<{ enviado: boolean; motivo: string }> {
    const { colegioId, tipoEvento, entidadId } = job;
    const dia = new Date(`${job.dia}T00:00:00.000Z`);
    const registros = new RegistroAvisoColegioRepository();
    const clave = { colegioId, tipoEvento, entidadId, dia };

    const existente = await registros.buscar(clave);
    if (existente && existente.estado !== "FALLIDO") {
        return { enviado: false, motivo: "duplicado" };
    }

    if (!(await avisosGlobalmenteHabilitados())) {
        await registros.registrarSiAusente(clave, "OMITIDO", "colegio.notificaciones.enabled=false");
        return { enviado: false, motivo: "omitido_global" };
    }

    const pref = await obtenerPreferenciaEfectiva(colegioId, tipoEvento);
    if (!pref.habilitado) {
        await registros.registrarSiAusente(clave, "OMITIDO", "aviso deshabilitado por el colegio");
        return { enviado: false, motivo: "omitido_preferencia" };
    }

    // Re-chequeo defensivo del tope a la hora del envío.
    const enviadosHoy = await registros.contarEnviadosDelDia(colegioId, dia);
    const tope = await obtenerTopeDiario();
    if (enviadosHoy >= tope) {
        await registros.registrarSiAusente(clave, "PENDIENTE_DIGEST", `tope diario alcanzado (${tope})`);
        return { enviado: false, motivo: "pendiente_digest" };
    }

    const email = await resolverEmailDestino(colegioId, pref.emailDestino);
    if (!email) {
        await registros.registrarSiAusente(clave, "OMITIDO", "sin destinatario configurado");
        return { enviado: false, motivo: "sin_destinatario" };
    }

    try {
        if (tipoEvento === "REPORTE_NUEVO") {
            await enviarAvisoReporteNuevoColegio(email);
        } else if (tipoEvento === "UMBRAL_CURSO") {
            const desde = new Date(Date.now() - pref.ventanaDias * DIA_MS);
            const reportes = await new AlertaColegioRepository().contarReportesDistintosPorCurso(colegioId, entidadId, desde);
            await enviarAvisoUmbralCursoColegio(email, { reportes, dias: pref.ventanaDias });
        } else if (tipoEvento === "ESTUDIANTE_REPETIDO") {
            const desde = new Date(Date.now() - pref.ventanaDias * DIA_MS);
            const reportes = await new AlertaColegioRepository().contarReportesDistintosPorEstudiante(colegioId, entidadId, desde);
            await enviarAvisoEstudianteRepetidoColegio(email, { reportes, dias: pref.ventanaDias });
        } else {
            throw new Error(`Tipo de evento no enviable por job: ${tipoEvento}`);
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (existente) {
            await registros.actualizarEstado(existente.id, "FALLIDO", msg.slice(0, 500));
        } else {
            await registros.registrarSiAusente(clave, "FALLIDO", msg.slice(0, 500));
        }
        throw error;
    }

    // ENVIADO solo tras el éxito del proveedor. Si la fila existía FALLIDO, se
    // actualiza (misma clave: la idempotencia no se duplica). El detalle del
    // job (SPEC-150: "observación especial") queda en el registro.
    if (existente) {
        await registros.actualizarEstado(existente.id, "ENVIADO", job.detalle);
    } else {
        await registros.registrarSiAusente(clave, "ENVIADO", job.detalle);
    }

    await logAudit({
        accion: "COLEGIO_AVISO_ENVIADO",
        tipoRecurso: "RegistroAvisoColegio",
        colegioId,
        valorNuevo: JSON.stringify({ tipoEvento, entidadId, dia: job.dia }),
        ipAddress: "worker",
        userAgent: "worker",
    });
    return { enviado: true, motivo: "enviado" };
}

/**
 * FR-003: tras cada alerta nueva evalúa los dos umbrales del colegio. Cruzan al
 * LLEGAR al umbral (conteo >= N/M dentro de la ventana móvil); la idempotencia
 * por día y entidad evita re-avisar por cada reporte del mismo día.
 */
export async function evaluarUmbralesPorAlerta(alertaId: string): Promise<void> {
    const alerta = await new AlertaColegioRepository().obtenerDestinoUmbrales(alertaId);
    const estudiante = alerta?.identificadorEstudiante.estudiante;
    if (!alerta || !estudiante) return;

    const colegioId = alerta.colegioId;
    const alertas = new AlertaColegioRepository();

    const prefCurso = await obtenerPreferenciaEfectiva(colegioId, "UMBRAL_CURSO");
    if (prefCurso.habilitado) {
        const desde = new Date(Date.now() - prefCurso.ventanaDias * DIA_MS);
        const reportesCurso = await alertas.contarReportesDistintosPorCurso(colegioId, estudiante.cursoId, desde);
        if (reportesCurso >= prefCurso.umbral) {
            await registrarEventoAviso({ colegioId, tipoEvento: "UMBRAL_CURSO", entidadId: estudiante.cursoId });
        }
    }

    const prefEstudiante = await obtenerPreferenciaEfectiva(colegioId, "ESTUDIANTE_REPETIDO");
    if (prefEstudiante.habilitado) {
        const desde = new Date(Date.now() - prefEstudiante.ventanaDias * DIA_MS);
        const reportesEstudiante = await alertas.contarReportesDistintosPorEstudiante(colegioId, estudiante.id, desde);
        // SPEC-150 (FR-003): observación especial ACTIVA ⇒ umbral efectivo 1
        // (aviso al PRIMER reporte); sin ella rige el umbral del colegio. La
        // idempotencia por día y entidad es la misma de siempre.
        const observacionActiva = await new EstudianteObservacionRepository().obtenerActiva(colegioId, estudiante.id);
        const umbralEfectivo = observacionActiva ? 1 : prefEstudiante.umbral;
        if (reportesEstudiante >= umbralEfectivo) {
            await registrarEventoAviso({
                colegioId,
                tipoEvento: "ESTUDIANTE_REPETIDO",
                entidadId: estudiante.id,
                ...(observacionActiva ? { detalle: "observación especial: aviso al primer reporte" } : {}),
            });
        }
    }
}
