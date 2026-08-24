/**
 * SPEC-223 (002-PI-124): digest semanal al CEO (BRIEF-ANALISIS §8.4, D-78).
 *
 * Job semanal (schedule pg-boss `analisis-digest-semanal`, lunes 08:00
 * America/Bogota por defecto, parametrizable): calcula la ventana de la semana
 * operativa anterior, persiste un `DigestSemanal` por destinatario de forma
 * idempotente y lo publica EXCLUSIVAMENTE por `motor.programar()` (FR-009) con
 * el evento `analisis.digest.semanal` — hereda canales, opt-out, quiet hours y
 * trazabilidad del Motor de Notificaciones.
 *
 * Notas de diseño (hallazgos contra el código real):
 * - `DigestSemanal.estado` son strings cerrados en minúsculas ("generado" |
 *   "enviado" | "fallido", patrón AlertaColegio), no un enum.
 * - El modelo no tiene `motivoFallo`: el error de cada digest (≤500 chars) va
 *   a `AuditLog.metadatos` (FR-014) — nunca texto de reportes (FR-007).
 * - El email sale en TEXTO PLANO (limitación del motor, `enviarEmailNotificacion`
 *   usa solo `text:`): las listas llegan pre-renderizadas en las variables.
 *
 * Moldes: `src/lib/motor/deriva-semanal.ts` (resultado tipado, nunca lanza al
 * worker, omite si enabled=false) y `src/lib/colegio/avisos-resumen.ts` (un
 * fallo por destinatario no detiene a los demás; AuditLog con ip "worker").
 */
import { formatInTimeZone } from "date-fns-tz";
import { programar } from "@/lib/notificaciones/motor";
import { AnalisisRepository, type RangoPeriodo } from "@/lib/dal/repositories/analisis-repository";
import { NotificacionReglaRepository } from "@/lib/dal/repositories/notificacion-regla";
import { getParametroSistemaValor } from "@/lib/parametros";
import { logAudit } from "@/lib/audit";
import { logger } from "../logger";
import { ZONA_BOGOTA } from "./periodos";
import { ventanaSemanaAnteriorBogota, type VentanaSemanal } from "./semana";
import {
    calcularDeltas,
    generarRecomendacionesSistema,
    parsearDestinatariosEmails,
    renderAnomalias,
    renderGanadoresPerdedores,
    renderRecomendacionesSistema,
    renderTablaKpis,
    renderTop5,
    type AnomaliaItem,
    type ClienteScore,
    type DecisionTop,
    type KpisSemana,
    type KpisVsPrevia,
} from "./digest-contenido";

export const EVENTO_DIGEST_SEMANAL = "analisis.digest.semanal";

/** Valores cerrados reales de `DigestSemanal.estado` (schema, SPEC-220). */
export const ESTADO_DIGEST = {
    GENERADO: "generado",
    ENVIADO: "enviado",
    FALLIDO: "fallido",
} as const;

const DIA_MS = 24 * 60 * 60 * 1000;
const MOTIVO_MAX_CHARS = 500;

export interface DestinatarioDigest {
    usuarioId?: string | undefined;
    email: string;
}

export interface ResultadoDigestSemanal {
    ejecutada: boolean;
    motivo?: string;
    periodo?: string;
    generados?: number;
    enviados?: number;
    fallidos?: number;
    omitidos?: number;
}

interface ParametrosDigest {
    enabled: boolean;
    destinatariosEmails: string;
    umbralCrecimientoPct: number;
}

/** Contenido de la semana calculado UNA vez y compartido por destinatario. */
interface ContenidoDigest {
    top5Decisiones: DecisionTop[];
    kpisSemana: KpisSemana;
    kpisVsPrevia: KpisVsPrevia;
    enlacePanel: string;
    /** Variables pre-renderizadas de la plantilla (texto plano, sin loops). */
    variables: Record<string, unknown>;
}

const repo = new AnalisisRepository();
const repoReglas = new NotificacionReglaRepository();

async function leerParametrosDigest(): Promise<ParametrosDigest> {
    const [enabled, emails, umbral] = await Promise.all([
        getParametroSistemaValor("analisis.digest.enabled"),
        getParametroSistemaValor("analisis.digest.destinatarios_emails"),
        getParametroSistemaValor("analisis.anomalias.crecimiento_pct_umbral"),
    ]);
    const umbralNum = Number.parseFloat(umbral ?? "");
    return {
        enabled: enabled !== "false",
        destinatariosEmails: emails ?? "",
        umbralCrecimientoPct: Number.isFinite(umbralNum) ? umbralNum : 25,
    };
}

/**
 * Destinatarios (FR-010): si el parámetro tiene correos, son exactamente esos
 * (resueltos a `usuarioId` cuando pertenecen a un usuario; los mal formados se
 * omiten con warn). Si está vacío, todos los usuarios ADMIN activos.
 */
async function resolverDestinatarios(emailsParam: string): Promise<DestinatarioDigest[]> {
    if (emailsParam.trim() === "") {
        const admins = await repo.listarAdminsActivosDigest();
        return admins.map((a) => ({ usuarioId: a.id, email: a.email }));
    }
    const { validos, invalidos } = parsearDestinatariosEmails(emailsParam);
    for (const invalido of invalidos) {
        console.warn(`[Analisis/Digest] Correo mal formado en analisis.digest.destinatarios_emails (omitido): ${invalido}`);
    }
    const destinatarios: DestinatarioDigest[] = [];
    for (const email of validos) {
        const usuario = await repo.buscarUsuarioDigestPorEmail(email);
        destinatarios.push({ usuarioId: usuario?.id, email });
    }
    return destinatarios;
}

function aKpisSemana(crudos: {
    recaudoUSD: number;
    recaudoCOP: number;
    nuevas: number;
    canceladas: number;
    activasAlInicio: number;
}): KpisSemana {
    return {
        recaudoUSD: crudos.recaudoUSD,
        recaudoCOP: crudos.recaudoCOP,
        nuevas: crudos.nuevas,
        canceladas: crudos.canceladas,
        churnRate:
            crudos.activasAlInicio > 0 ? crudos.canceladas / crudos.activasAlInicio : null,
        scorePromedio: null, // se completa con los snapshots del período
    };
}

/**
 * Calcula una sola vez el contenido base de la semana (FR-005): top 5
 * decisiones, KPIs con delta vs semana previa, anomalías (vacías si SPEC-225
 * no tiene datos), ganadores/perdedores de score, recomendaciones del sistema
 * y enlace al panel. Todo agregado de negocio, cero PII de menores.
 */
async function construirContenido(
    ventana: VentanaSemanal,
    umbralCrecimientoPct: number
): Promise<ContenidoDigest> {
    const rangoActual: RangoPeriodo = { desde: ventana.desde, hasta: ventana.hasta };
    const rangoPrevia: RangoPeriodo = {
        desde: new Date(ventana.desde.getTime() - 7 * DIA_MS),
        hasta: ventana.desde,
    };
    // Ganadores/perdedores y score promedio: snapshots del período mensual
    // Bogotá que contiene el inicio de la ventana (data-model §4).
    const periodoMes = formatInTimeZone(ventana.desde, ZONA_BOGOTA, "yyyy-MM");

    const [top5Crudo, crudosActual, crudosPrevia, anomaliasCrudo, scores] = await Promise.all([
        repo.topRecomendacionesPendientes(5),
        repo.kpisVentana(rangoActual),
        repo.kpisVentana(rangoPrevia),
        repo.anomaliasEnVentana(rangoActual),
        repo.scoresConNombreCliente(periodoMes),
    ]);

    const kpisSemana = aKpisSemana(crudosActual);
    kpisSemana.scorePromedio =
        scores.length > 0
            ? scores.reduce((acc, s) => acc + s.scoreTotal, 0) / scores.length
            : null;
    const kpisPrevia = aKpisSemana(crudosPrevia);
    const kpisVsPrevia = calcularDeltas(kpisSemana, kpisPrevia);

    const top5Decisiones: DecisionTop[] = top5Crudo.map((r) => ({
        titulo: r.titulo,
        descripcion: r.descripcion,
        accion: r.accionSugerida,
    }));
    const anomalias: AnomaliaItem[] = anomaliasCrudo.map((a) => ({
        severidad: a.severidad,
        descripcion: a.descripcion,
    }));
    const ganadores: ClienteScore[] = scores.slice(0, 3);
    const perdedores: ClienteScore[] = scores.slice(-3).reverse();
    const recomendaciones = generarRecomendacionesSistema(
        kpisSemana,
        kpisPrevia,
        umbralCrecimientoPct
    );
    const enlacePanel = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005"}/dashboard/admin/estadisticas/dinero-vs-valor`;

    const variables: Record<string, unknown> = {
        periodo: ventana.periodo,
        fechaInicio: formatInTimeZone(ventana.desde, ZONA_BOGOTA, "yyyy-MM-dd"),
        fechaFin: formatInTimeZone(new Date(ventana.hasta.getTime() - DIA_MS), ZONA_BOGOTA, "yyyy-MM-dd"),
        top5Decisiones: renderTop5(top5Decisiones),
        tablaKpis: renderTablaKpis(kpisSemana, kpisVsPrevia),
        numAnomalias: String(anomalias.length),
        anomalias: renderAnomalias(anomalias),
        ganadoresPerdedores: renderGanadoresPerdedores(ganadores, perdedores),
        recomendacionesSistema: renderRecomendacionesSistema(recomendaciones),
        enlacePanel,
    };

    return { top5Decisiones, kpisSemana, kpisVsPrevia, enlacePanel, variables };
}

function truncarMotivo(err: unknown): string {
    const crudo = err instanceof Error ? err.message : String(err);
    return crudo.slice(0, MOTIVO_MAX_CHARS);
}

async function auditar(
    accion: "ANALISIS_DIGEST_GENERADO" | "ANALISIS_DIGEST_ENVIADO" | "ANALISIS_DIGEST_FALLIDO",
    metadatos: Record<string, unknown>,
    recursoId?: string
): Promise<void> {
    await logAudit({
        accion,
        tipoRecurso: "DigestSemanal",
        recursoId,
        ipAddress: "worker",
        userAgent: "worker",
        metadatos,
    });
}

/**
 * Decide el resultado tras `programar` con 0 notificaciones (FR-015): sin
 * reglas activas del evento → fallo real; con reglas activas → las omitió la
 * preferencia del usuario (D-70) y el digest queda enviado igual.
 */
async function resultadoConCeroProgramadas(
    digestId: string,
    periodo: string
): Promise<"enviado" | "fallido"> {
    const reglas = await repoReglas.findByEventoActivo(EVENTO_DIGEST_SEMANAL);
    if (reglas.length === 0) {
        await repo.marcarDigestFallido(digestId);
        await auditar("ANALISIS_DIGEST_FALLIDO", {
            periodo,
            motivo: "sin_reglas_activas_motor",
        }, digestId);
        return "fallido";
    }
    await repo.marcarDigestEnviado(digestId);
    await auditar("ANALISIS_DIGEST_ENVIADO", {
        periodo,
        programadas: 0,
        omitidas_por_preferencia: true,
    }, digestId);
    return "enviado";
}

/**
 * Genera (o regenera, si quedó "fallido") el digest de UN destinatario y lo
 * publica por Motor Notif. Un digest ya "enviado" es no-op (idempotencia ante
 * retries de pg-boss). Nunca lanza: registra su propio estado y auditoría.
 */
export async function generarDigestParaDestinatario(
    destinatario: DestinatarioDigest,
    ventana: VentanaSemanal,
    contenido: ContenidoDigest
): Promise<"enviado" | "omitido" | "fallido"> {
    const periodo = ventana.periodo;

    // Destinatario por email sin usuario en BD: no hay fila DigestSemanal
    // (no hay destinatarioId para la unicidad); su envío queda en auditoría
    // (data-model §2). Sin usuarioId el motor no aplica opt-out.
    if (!destinatario.usuarioId) {
        try {
            const resultado = await programar({
                evento: EVENTO_DIGEST_SEMANAL,
                sujetoTipo: "DigestSemanal",
                sujetoId: periodo,
                destinatarios: [{ email: destinatario.email, variables: contenido.variables }],
            });
            if (resultado.programadas > 0) {
                await auditar("ANALISIS_DIGEST_ENVIADO", {
                    periodo,
                    emailDestinatario: destinatario.email,
                    programadas: resultado.programadas,
                    sin_fila: true,
                });
                return "enviado";
            }
            await auditar("ANALISIS_DIGEST_FALLIDO", {
                periodo,
                emailDestinatario: destinatario.email,
                motivo: "motor_sin_programadas",
                sin_fila: true,
            });
            return "fallido";
        } catch (err) {
            await auditar("ANALISIS_DIGEST_FALLIDO", {
                periodo,
                emailDestinatario: destinatario.email,
                motivo: truncarMotivo(err),
                sin_fila: true,
            });
            return "fallido";
        }
    }

    let digestId: string | null = null;
    try {
        const existente = await repo.buscarDigest(periodo, destinatario.usuarioId);
        if (existente?.estado === ESTADO_DIGEST.ENVIADO) {
            return "omitido";
        }

        const digest = await repo.upsertDigest({
            periodo,
            destinatarioId: destinatario.usuarioId,
            top5Decisiones: contenido.top5Decisiones,
            kpisSemana: contenido.kpisSemana,
            kpisVsPrevia: contenido.kpisVsPrevia,
            enlacePanel: contenido.enlacePanel,
        });
        digestId = digest.id;
        await auditar("ANALISIS_DIGEST_GENERADO", {
            periodo,
            regenerado: existente !== null,
        }, digest.id);

        const resultado = await programar({
            evento: EVENTO_DIGEST_SEMANAL,
            sujetoTipo: "DigestSemanal",
            sujetoId: digest.id,
            destinatarios: [
                {
                    usuarioId: destinatario.usuarioId,
                    email: destinatario.email,
                    variables: contenido.variables,
                },
            ],
        });

        if (resultado.programadas > 0) {
            await repo.marcarDigestEnviado(digest.id);
            await auditar("ANALISIS_DIGEST_ENVIADO", {
                periodo,
                programadas: resultado.programadas,
            }, digest.id);
            return "enviado";
        }
        return await resultadoConCeroProgramadas(digest.id, periodo);
    } catch (err) {
        console.error(`[Analisis/Digest] Fallo con destinatario ${destinatario.email}:`, err);
        // El motivo (≤500 chars) va a auditoría; el modelo no tiene motivoFallo.
        if (digestId) await repo.marcarDigestFallido(digestId).catch(() => undefined);
        await auditar("ANALISIS_DIGEST_FALLIDO", {
            periodo,
            motivo: truncarMotivo(err),
        }, digestId ?? undefined);
        return "fallido";
    }
}

/**
 * Handler del schedule `analisis-digest-semanal`: genera y envía el digest de
 * la semana operativa anterior a todos los destinatarios resueltos. Nunca
 * lanza al worker; devuelve el resumen agregado de la corrida.
 */
export async function ejecutarDigestSemanal(ahora: Date = new Date()): Promise<ResultadoDigestSemanal> {
    const params = await leerParametrosDigest();
    if (!params.enabled) {
        logger.info("[Analisis/Digest] Job semanal: omitido — analisis.digest.enabled=false");
        return { ejecutada: false, motivo: "deshabilitada" };
    }

    const ventana = ventanaSemanaAnteriorBogota(ahora);
    const destinatarios = await resolverDestinatarios(params.destinatariosEmails);
    if (destinatarios.length === 0) {
        await auditar("ANALISIS_DIGEST_FALLIDO", {
            periodo: ventana.periodo,
            motivo: "sin_destinatarios",
        });
        logger.info(`[Analisis/Digest] Job semanal: sin destinatarios resolubles (periodo=${ventana.periodo})`);
        return {
            ejecutada: true,
            motivo: "sin_destinatarios",
            periodo: ventana.periodo,
            generados: 0,
            enviados: 0,
            fallidos: 0,
            omitidos: 0,
        };
    }

    const contenido = await construirContenido(ventana, params.umbralCrecimientoPct);

    let generados = 0;
    let enviados = 0;
    let fallidos = 0;
    let omitidos = 0;
    for (const destinatario of destinatarios) {
        // Un fallo con un destinatario no detiene a los demás (FR-014).
        const resultado = await generarDigestParaDestinatario(destinatario, ventana, contenido);
        if (resultado === "enviado") {
            enviados++;
        } else if (resultado === "omitido") {
            omitidos++;
        } else {
            fallidos++;
        }
        // `generados` cuenta filas DigestSemanal (los destinatarios email-only
        // no tienen fila, data-model §2).
        if (resultado !== "omitido" && destinatario.usuarioId) generados++;
    }

    logger.info(
        `[Analisis/Digest] Job semanal: periodo=${ventana.periodo} — ${enviados} enviados, ${fallidos} fallidos, ${omitidos} omitidos (${destinatarios.length} destinatarios)`
    );
    return {
        ejecutada: true,
        periodo: ventana.periodo,
        generados,
        enviados,
        fallidos,
        omitidos,
    };
}
