/**
 * SPEC-236 (002-PI-mega-cola): tareas del worker del motor de expediente.
 *
 * Cuatro tareas idempotentes ejecutadas en cada tick:
 * 1. Auto-cierre por inactividad (ACTIVO → CERRADO, FR-009).
 * 2. Vigilancia del SLA del comité (48h normal / 12h ROJO, FR-015).
 * 3. Recálculo de gravedad 24h con alerta de subida a ROJO (FR-014).
 * 4. Purga de retención: overwrite a `[retenido]` sin borrar filas (FR-016).
 *
 * Todas las fechas se evalúan en America/Bogota vía fechas-motor (US2.4).
 *
 * Desviaciones documentadas del plan:
 * - SLA: el reloj arranca en la entrada al estado (updatedAt), no en
 *   createdAt del expediente: un expediente viejo recién pasado a
 *   PENDIENTE_COMITE no debe alertar al instante (US2.2 "sin actividad del
 *   comité dentro del SLA").
 * - Retención: el plazo corre desde fechaCierre (fallback createdAt), según
 *   la descripción del parámetro en data-model.md ("meses tras cierre").
 */
import { EstadoExpediente, ScoreGravedad } from "@prisma/client";
import type { EventoExpediente, Expediente } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { getParametroSistemaValor } from "@/lib/parametros";
import { ExpedienteMotorRepository } from "@/lib/dal/repositories/expediente-motor-repository";
import { aplicarTransicion, MOTIVO_AUTO_CIERRE_INACTIVIDAD } from "../estados/aplicar-transicion";
import { publicarEventoExpediente } from "../estados/publicar-evento-expediente";
import { EVENTOS_EXPEDIENTE } from "../estados/transiciones";
import {
    calcularLimiteInactividad,
    calcularLimiteRetencion,
    calcularFechaLimiteSla,
    decidirSlaHoras,
} from "./fechas-motor";
import {
    cargarParametrosCompilacion,
    cargarSeveridadCategorias,
} from "../compilacion/compilar-expediente";
import { obtenerSenalComunitaria } from "../compilacion/queries/senal-comunitaria";
import { detectarAceleracion } from "../compilacion/reglas/aceleracion";
import { detectarProgresion } from "../compilacion/reglas/progresion";
import { detectarPerpetradorSerial } from "../compilacion/reglas/perpetrador-serial";
import { detectarMultiplataforma } from "../compilacion/reglas/multiplataforma";
import { calcularScore } from "../compilacion/score/calcular-score";

export const TEXTO_RETENIDO = "[retenido]";

const ACTOR_WORKER = { id: "worker-expediente-motor", tipo: "worker" as const };

const DEFAULTS = {
    autoCierreMeses: 6,
    retencionMeses: 24,
    slaHorasNormal: 48,
    slaHorasRojo: 12,
    limiteLote: 100,
};

async function numParam(clave: string, defecto: number): Promise<number> {
    const raw = await getParametroSistemaValor(clave);
    const parsed = Number.parseInt(raw ?? String(defecto), 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : defecto;
}

/** FR-009: cierra expedientes ACTIVO cuya última actividad supera el plazo. */
export async function cerrarExpedientesInactivos(ahora: Date = new Date()): Promise<number> {
    const meses = await numParam("padre.expediente.auto_cierre_meses", DEFAULTS.autoCierreMeses);
    const limite = calcularLimiteInactividad(ahora, meses);

    const candidatos = await new ExpedienteMotorRepository().listarActivosInactivos(limite, DEFAULTS.limiteLote);

    let cerrados = 0;
    for (const exp of candidatos) {
        try {
            await aplicarTransicion({
                expedienteId: exp.id,
                estadoDestino: EstadoExpediente.CERRADO,
                motivo: MOTIVO_AUTO_CIERRE_INACTIVIDAD,
                actor: ACTOR_WORKER,
            });
            cerrados++;
        } catch (error) {
            console.warn(
                `[ExpedienteMotor] Auto-cierre omitido: expediente=${exp.id} —`,
                error instanceof Error ? error.message : error
            );
        }
    }
    return cerrados;
}

/**
 * FR-015: alerta expedientes PENDIENTE_COMITE con SLA vencido.
 * Idempotente por entrada al estado: solo publica si no hay un
 * EXPEDIENTE_SLA_VENCIDO posterior a la última actualización del expediente.
 */
export async function vigilarSlaComite(ahora: Date = new Date()): Promise<number> {
    const slaNormal = await numParam("padre.comite.sla_horas_normal", DEFAULTS.slaHorasNormal);
    const slaRojo = await numParam("padre.comite.sla_horas_gravedad_roja", DEFAULTS.slaHorasRojo);

    const pendientes = await new ExpedienteMotorRepository().listarPendientesComite(DEFAULTS.limiteLote);

    let alertados = 0;
    for (const exp of pendientes) {
        const horas = decidirSlaHoras(exp.scoreGravedadActual, slaNormal, slaRojo);
        const fechaLimite = calcularFechaLimiteSla(exp.updatedAt, horas);
        if (ahora.getTime() <= fechaLimite.getTime()) continue;

        const ultimoAviso = await new ExpedienteMotorRepository().obtenerUltimoAvisoSla(exp.id);
        if (ultimoAviso && ultimoAviso.creadoEn.getTime() >= exp.updatedAt.getTime()) continue;

        await logAudit({
            accion: "EXPEDIENTE_SLA_VENCIDO",
            tipoRecurso: "Expediente",
            recursoId: exp.id,
            ipAddress: "worker",
            userAgent: "expediente-motor/worker",
            metadatos: {
                scoreGravedadActual: exp.scoreGravedadActual,
                slaHoras: horas,
                fechaLimite: fechaLimite.toISOString(),
            },
        });
        await publicarEventoExpediente(EVENTOS_EXPEDIENTE.COMITE_SLA_VENCIDO, {
            expediente: exp,
            actor: ACTOR_WORKER.id,
            motivo: `SLA de comité vencido (${horas}h)`,
            fechaLimite,
        });
        alertados++;
    }
    return alertados;
}

/** Recalcula el score de un expediente con la misma fórmula determinista de SPEC-234. */
export async function recalcularGravedadExpediente(
    expediente: Expediente & { eventos: EventoExpediente[] }
): Promise<{ anterior: ScoreGravedad; nuevo: ScoreGravedad }> {
    const params = await cargarParametrosCompilacion();
    const [senal, severidadPorCategoria] = await Promise.all([
        obtenerSenalComunitaria(expediente.identificadorReportado),
        cargarSeveridadCategorias(),
    ]);

    const eventos = expediente.eventos;
    const patrones = [
        detectarAceleracion(eventos, params.aceleracionRatioMinimo),
        detectarProgresion(eventos, severidadPorCategoria),
        detectarPerpetradorSerial(eventos, params.senalComunitariaPerpetradorSerial),
        detectarMultiplataforma(eventos, params.multiplataformaMin),
    ];

    const eventosCategoriaGrave = eventos.filter((e) =>
        params.categoriasGraves.includes(e.categoriaDetectada ?? "")
    ).length;
    const senalComunitariaScore = senal.totalExpedientesActivos + senal.totalExpedientesEscalados * 2;

    const { gravedad } = calcularScore({
        numEventos: eventos.length,
        eventosCategoriaGrave,
        patrones,
        senalComunitariaScore,
        pesoNumReportes: params.pesoNumReportes,
        pesoCategoriaGrave: params.pesoCategoriaGrave,
        pesoAceleracion: params.pesoAceleracion,
        pesoSenalComunitaria: params.pesoSenalComunitaria,
        umbralAmarillo: params.umbralAmarillo,
        umbralRojo: params.umbralRojo,
    });

    return { anterior: expediente.scoreGravedadActual, nuevo: gravedad };
}

/**
 * FR-014: recalcula gravedad de expedientes con actividad en las últimas 24h.
 * Publica expediente.gravedad.subio_a_rojo solo cuando el score anterior no
 * era ROJO y el nuevo sí lo es (edge case "ROJO que ya era ROJO").
 */
export async function recalcularGravedad24h(ahora: Date = new Date()): Promise<number> {
    const desde = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
    const candidatos = await new ExpedienteMotorRepository().listarParaRecalculoGravedad(desde, DEFAULTS.limiteLote);

    let subidosARojo = 0;
    for (const exp of candidatos) {
        try {
            const { anterior, nuevo } = await recalcularGravedadExpediente(exp);
            if (nuevo === anterior) continue;

            const actualizado = await new ExpedienteMotorRepository().actualizarScoreGravedad(exp.id, nuevo);

            if (anterior !== ScoreGravedad.ROJO && nuevo === ScoreGravedad.ROJO) {
                await logAudit({
                    accion: "EXPEDIENTE_GRAVEDAD_SUBIO_A_ROJO",
                    tipoRecurso: "Expediente",
                    recursoId: exp.id,
                    valorAnterior: anterior,
                    valorNuevo: nuevo,
                    ipAddress: "worker",
                    userAgent: "expediente-motor/worker",
                    metadatos: { anterior, nuevo },
                });
                await publicarEventoExpediente(EVENTOS_EXPEDIENTE.GRAVEDAD_SUBIO_A_ROJO, {
                    expediente: actualizado,
                    actor: ACTOR_WORKER.id,
                    motivo: `Gravedad subió de ${anterior} a ROJO`,
                });
                subidosARojo++;
            }
        } catch (error) {
            console.warn(
                `[ExpedienteMotor] Recálculo de gravedad omitido: expediente=${exp.id} —`,
                error instanceof Error ? error.message : error
            );
        }
    }
    return subidosARojo;
}

/**
 * FR-016: purga de retención. Sobrescribe campos sensibles con `[retenido]`
 * en expedientes CERRADO cuyo plazo venció. Nunca elimina filas (US3.2) y es
 * idempotente: un campo ya `[retenido]` no se contabiliza ni republica.
 */
export async function purgarRetenidos(ahora: Date = new Date()): Promise<number> {
    const meses = await numParam("padre.expediente.retencion_cerrados_meses", DEFAULTS.retencionMeses);
    const limite = calcularLimiteRetencion(ahora, meses);

    const candidatos = await new ExpedienteMotorRepository().listarCerradosParaRetencion(limite, DEFAULTS.limiteLote);

    let purgados = 0;
    for (const exp of candidatos) {
        const { eventos: eventosActualizados, informes: informesActualizados } =
            await new ExpedienteMotorRepository().purgarCamposSensibles(exp.id, TEXTO_RETENIDO);

        if (eventosActualizados === 0 && informesActualizados === 0) continue;

        await logAudit({
            accion: "EXPEDIENTE_RETENIDO",
            tipoRecurso: "Expediente",
            recursoId: exp.id,
            ipAddress: "worker",
            userAgent: "expediente-motor/worker",
            metadatos: {
                motivo: "RETENCION_DATOS",
                eventosActualizados,
                informesActualizados,
            },
        });
        purgados++;
    }
    return purgados;
}
