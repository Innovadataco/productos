/**
 * SPEC-213 (002-PI-113): motor de vigencia de pagos.
 *
 * Ejecuta la corrida diaria de la máquina de estados de suscripciones:
 *   ACTIVA → EN_GRACIA (al llegar a fechaFin)
 *   EN_GRACIA → SUSPENDIDA (al llegar a fechaFin + pagos.gracia_dias)
 *   ACTIVA (esFreemium) → SUSPENDIDA (si freemiumFechaFin < hoy Bogotá)
 * Las transiciones EN_GRACIA/SUSPENDIDA → ACTIVA y → CANCELADA son manuales
 * (SPEC-212) y NO las ejecuta este worker (FR-005).
 *
 * - Toda comparación de fechas se hace en hora de pared America/Bogota (FR-004).
 * - Cada transición automática queda en AuditLog con actor SYSTEM (FR-006;
 *   `usuarioId` queda null porque AuditLog tiene FK a Usuario y no existe un
 *   usuario SYSTEM — el actor va en `metadatos.actor`).
 * - Emite los eventos del catálogo §10 vía `motor.programar()` (FR-007). Si el
 *   motor no está disponible o un evento no tiene reglas activas, se loguea
 *   warning y la corrida continúa (fail-open FR-012).
 * - Idempotencia: una sola corrida efectiva por día Bogotá
 *   (`pagos.vigencia.ultima_corrida`) + transición optimista por fila (FR-008).
 * - Procesamiento en lotes de 100 (FR-009). No recalcula pagos ni vistas (FR-010).
 */
import { EstadoSuscripcion } from "@prisma/client";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { addDays, differenceInCalendarDays, endOfDay, format, startOfDay } from "date-fns";
import { PagosVigenciaRepository } from "@/lib/dal/repositories/pagos-vigencia-repository";
import { NotificacionReglaRepository } from "@/lib/dal/repositories/notificacion-regla";
import { programar } from "@/lib/notificaciones/motor";
import { logAudit } from "@/lib/audit";

const ZONA_BOGOTA = "America/Bogota";
const LOTE = 100;
const GRACIA_DIAS_DEFAULT = 3;

/** Eventos del catálogo §10 del BRIEF que emite este worker. */
export const EVENTOS_VIGENCIA = {
    POR_VENCER_T_MENOS_5: "suscripcion.por_vencer.T_menos_5",
    POR_VENCER_T_MENOS_1: "suscripcion.por_vencer.T_menos_1",
    VENCIDA_T_0: "suscripcion.vencida.T_0",
    GRACIA_T_MAS_2: "suscripcion.gracia.T_mas_2",
    CORTADA_T_MAS_3: "suscripcion.cortada.T_mas_3",
    FREEMIUM_T_MENOS_7: "suscripcion.freemium.T_menos_7",
    FREEMIUM_T_MENOS_1: "suscripcion.freemium.T_menos_1",
    FREEMIUM_TERMINADO: "suscripcion.freemium.terminado",
} as const;

const EVENTOS_DEL_WORKER: string[] = Object.values(EVENTOS_VIGENCIA);

export interface TransicionVigencia {
    suscripcionId: string;
    estadoAnterior: EstadoSuscripcion;
    estadoNuevo: EstadoSuscripcion;
    evento: string;
}

export interface ResultadoCorridaVigencia {
    transiciones: TransicionVigencia[];
    eventosProgramados: number;
    /** true cuando el día Bogotá ya tenía una corrida efectiva (FR-008). */
    omitida: boolean;
}

type SuscripcionVigencia = Awaited<ReturnType<PagosVigenciaRepository["listarActivasPorVencer"]>>[number];

/** "Ahora" como hora de pared Bogotá. `fechaForzada` (tests): "yyyy-MM-dd" o ISO con hora, interpretada en Bogotá. */
function ahoraBogota(fechaForzada?: string): Date {
    if (!fechaForzada) return toZonedTime(new Date(), ZONA_BOGOTA);
    const base = fechaForzada.length === 10 ? `${fechaForzada}T12:00:00` : fechaForzada;
    return toZonedTime(fromZonedTime(base, ZONA_BOGOTA), ZONA_BOGOTA);
}

function inicioDiaUtc(diaPared: Date): Date {
    return fromZonedTime(startOfDay(diaPared), ZONA_BOGOTA);
}

function finDiaUtc(diaPared: Date): Date {
    return fromZonedTime(endOfDay(diaPared), ZONA_BOGOTA);
}

function fechaTexto(fecha: Date | null): string {
    if (!fecha) return "";
    return format(toZonedTime(fecha, ZONA_BOGOTA), "yyyy-MM-dd");
}

function diasCalendarioHasta(fechaUtc: Date, hoyPared: Date): number {
    return differenceInCalendarDays(startOfDay(toZonedTime(fechaUtc, ZONA_BOGOTA)), startOfDay(hoyPared));
}

/**
 * Convierte `pagos.vigencia.hora_corrida` ("HH:mm", Bogotá) a expresión cron
 * diaria. Default 01:00 ante cualquier valor inválido (FR-003).
 */
export function horaCorridaACron(hora: string | null | undefined): string {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((hora ?? "").trim());
    if (!match) return "0 1 * * *";
    return `${Number(match[2])} ${Number(match[1])} * * *`;
}

/** Destinatarios del titular: usuario padre, admin del colegio o representante legal. */
function resolverDestinatarios(s: SuscripcionVigencia, fecha: string) {
    if (s.usuario) {
        return [{ usuarioId: s.usuario.id, variables: { nombre: s.usuario.nombre ?? "", fecha } }];
    }
    if (s.colegio?.admin) {
        return [
            {
                usuarioId: s.colegio.admin.id,
                variables: { nombre: s.colegio.admin.nombre ?? s.colegio.nombre, fecha },
            },
        ];
    }
    if (s.colegio?.representanteLegalEmail) {
        return [
            {
                email: s.colegio.representanteLegalEmail,
                variables: { nombre: s.colegio.representanteLegalNombre || s.colegio.nombre, fecha },
            },
        ];
    }
    return [];
}

/** Emisión fail-open al motor de notificaciones (FR-012). Devuelve cuántas quedaron programadas. */
async function emitirEvento(evento: string, s: SuscripcionVigencia, fecha: string): Promise<number> {
    const destinatarios = resolverDestinatarios(s, fecha);
    if (destinatarios.length === 0) {
        console.warn(`[Vigencia] ${evento}: ${s.id} — sin destinatario conocido; notificación omitida`);
        return 0;
    }
    try {
        const resultado = await programar({
            evento,
            sujetoTipo: "Suscripcion",
            sujetoId: s.id,
            destinatarios,
        });
        return resultado.programadas;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Vigencia] ${evento}: ${s.id} — motor de notificaciones no disponible (${msg}); se continúa`);
        return 0;
    }
}

async function auditarTransicion(
    s: SuscripcionVigencia,
    estadoAnterior: EstadoSuscripcion,
    estadoNuevo: EstadoSuscripcion,
    motivo: string,
    fechaBogota: string
): Promise<void> {
    await logAudit({
        accion: "SUSCRIPCION_TRANSICION_AUTOMATICA",
        tipoRecurso: "Suscripcion",
        recursoId: s.id,
        valorAnterior: estadoAnterior,
        valorNuevo: estadoNuevo,
        ipAddress: "job",
        userAgent: "worker-vigencia-pagos",
        metadatos: {
            actor: "SYSTEM",
            suscripcionId: s.id,
            estadoAnterior,
            estadoNuevo,
            motivo,
            fechaBogota,
        },
    });
}

async function verificarCatalogo(repoRegla: NotificacionReglaRepository): Promise<void> {
    const faltantes: string[] = [];
    for (const evento of EVENTOS_DEL_WORKER) {
        try {
            const reglas = await repoRegla.findByEventoActivo(evento);
            if (reglas.length === 0) faltantes.push(evento);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[Vigencia] No se pudo verificar reglas de ${evento}: ${msg}`);
            faltantes.push(evento);
        }
    }
    if (faltantes.length > 0) {
        // FR-012: fail-open. La Decisión 3 de la spec proponía abortar; manda el FR:
        // las transiciones no se bloquean por notificaciones faltantes.
        console.warn(
            `[Vigencia] Catálogo incompleto: sin reglas activas para ${faltantes.join(", ")} — ` +
                "se emiten igual (el motor descarta sin regla); pendiente seed del catálogo §10 (SPEC-201)"
        );
    }
}

/**
 * Ejecuta la corrida diaria de vigencia. Contrato: `contracts/213-motor-vigencia.md`.
 */
export async function ejecutarCorrida(opciones?: {
    forzarFechaBogota?: string;
}): Promise<ResultadoCorridaVigencia> {
    const repo = new PagosVigenciaRepository();
    const repoRegla = new NotificacionReglaRepository();

    const ahora = ahoraBogota(opciones?.forzarFechaBogota);
    const hoyISO = format(ahora, "yyyy-MM-dd");

    // FR-008: una sola corrida efectiva por día Bogotá.
    const ultima = await repo.obtenerParametroVigencia("pagos.vigencia.ultima_corrida");
    if (ultima?.valor === hoyISO) {
        console.warn(`[Vigencia] Corrida ${hoyISO}: ya ejecutada hoy; se omite (idempotencia)`);
        return { transiciones: [], eventosProgramados: 0, omitida: true };
    }

    await verificarCatalogo(repoRegla);

    const paramGracia = await repo.obtenerParametroVigencia("pagos.gracia_dias");
    const graciaParsed = Number.parseInt(paramGracia?.valor ?? "", 10);
    const graciaDias = Number.isFinite(graciaParsed) && graciaParsed >= 0 ? graciaParsed : GRACIA_DIAS_DEFAULT;

    const inicioHoyUtc = inicioDiaUtc(ahora);
    const finHoyUtc = finDiaUtc(ahora);

    const transiciones: TransicionVigencia[] = [];
    let eventosProgramados = 0;

    // ── 1. Freemium vencido: ACTIVA (esFreemium) → SUSPENDIDA (AS-004) ──
    // Se evalúa primero: el corte freemium prevalece sobre la entrada a gracia.
    for (;;) {
        const lote = await repo.listarFreemiumVencidas(inicioHoyUtc, LOTE);
        if (lote.length === 0) break;
        for (const s of lote) {
            const resultado = await repo.transitarSuscripcionSiEstado(s.id, EstadoSuscripcion.ACTIVA, {
                estado: EstadoSuscripcion.SUSPENDIDA,
                suspendidaEn: new Date(),
            });
            if (resultado.count === 0) continue; // ya transitada por otra corrida
            await auditarTransicion(s, EstadoSuscripcion.ACTIVA, EstadoSuscripcion.SUSPENDIDA, "freemium_terminado", hoyISO);
            eventosProgramados += await emitirEvento(EVENTOS_VIGENCIA.FREEMIUM_TERMINADO, s, fechaTexto(s.freemiumFechaFin));
            transiciones.push({
                suscripcionId: s.id,
                estadoAnterior: EstadoSuscripcion.ACTIVA,
                estadoNuevo: EstadoSuscripcion.SUSPENDIDA,
                evento: EVENTOS_VIGENCIA.FREEMIUM_TERMINADO,
            });
            console.warn(`[Vigencia] ACTIVA→SUSPENDIDA (freemium): ${s.id} — ok`);
        }
    }

    // ── 2. ACTIVA → EN_GRACIA al llegar a fechaFin (AS-001) ──
    for (;;) {
        const lote = await repo.listarActivasPorVencer(finHoyUtc, LOTE);
        if (lote.length === 0) break;
        for (const s of lote) {
            const fechaCorteProgramado = addDays(s.fechaFin, graciaDias);
            const resultado = await repo.transitarSuscripcionSiEstado(s.id, EstadoSuscripcion.ACTIVA, {
                estado: EstadoSuscripcion.EN_GRACIA,
                fechaCorteProgramado,
            });
            if (resultado.count === 0) continue;
            await auditarTransicion(s, EstadoSuscripcion.ACTIVA, EstadoSuscripcion.EN_GRACIA, "fecha_fin_alcanzada", hoyISO);
            eventosProgramados += await emitirEvento(EVENTOS_VIGENCIA.VENCIDA_T_0, s, fechaTexto(s.fechaFin));
            transiciones.push({
                suscripcionId: s.id,
                estadoAnterior: EstadoSuscripcion.ACTIVA,
                estadoNuevo: EstadoSuscripcion.EN_GRACIA,
                evento: EVENTOS_VIGENCIA.VENCIDA_T_0,
            });
            console.warn(`[Vigencia] ACTIVA→EN_GRACIA: ${s.id} — corte programado ${fechaTexto(fechaCorteProgramado)}`);
        }
    }

    // ── 3. EN_GRACIA → SUSPENDIDA al llegar a fechaCorteProgramado (AS-002) ──
    for (;;) {
        const lote = await repo.listarEnGraciaPorCortar(finHoyUtc, LOTE);
        if (lote.length === 0) break;
        for (const s of lote) {
            const resultado = await repo.transitarSuscripcionSiEstado(s.id, EstadoSuscripcion.EN_GRACIA, {
                estado: EstadoSuscripcion.SUSPENDIDA,
                suspendidaEn: new Date(),
            });
            if (resultado.count === 0) continue;
            await auditarTransicion(s, EstadoSuscripcion.EN_GRACIA, EstadoSuscripcion.SUSPENDIDA, "gracia_vencida", hoyISO);
            eventosProgramados += await emitirEvento(EVENTOS_VIGENCIA.CORTADA_T_MAS_3, s, fechaTexto(s.fechaCorteProgramado));
            transiciones.push({
                suscripcionId: s.id,
                estadoAnterior: EstadoSuscripcion.EN_GRACIA,
                estadoNuevo: EstadoSuscripcion.SUSPENDIDA,
                evento: EVENTOS_VIGENCIA.CORTADA_T_MAS_3,
            });
            console.warn(`[Vigencia] EN_GRACIA→SUSPENDIDA: ${s.id} — ok`);
        }
    }

    // ── 4. Recordatorios programados (AS-006). No mutan estado. ──

    // 4a. suscripcion.por_vencer.T_menos_5 / T_menos_1 (ACTIVA próximas a vencer).
    const finVentanaVencerUtc = finDiaUtc(addDays(ahora, 5));
    for (let skip = 0; ; skip += LOTE) {
        const lote = await repo.listarActivasEnVentanaFechaFin(inicioHoyUtc, finVentanaVencerUtc, { skip, take: LOTE });
        if (lote.length === 0) break;
        for (const s of lote) {
            const dias = diasCalendarioHasta(s.fechaFin, ahora);
            if (dias === 5) {
                eventosProgramados += await emitirEvento(EVENTOS_VIGENCIA.POR_VENCER_T_MENOS_5, s, fechaTexto(s.fechaFin));
            } else if (dias === 1) {
                eventosProgramados += await emitirEvento(EVENTOS_VIGENCIA.POR_VENCER_T_MENOS_1, s, fechaTexto(s.fechaFin));
            }
        }
        if (lote.length < LOTE) break;
    }

    // 4b. suscripcion.gracia.T_mas_2 (EN_GRACIA en su día 2 de gracia: fechaFin fue anteayer).
    const diaGracia2 = addDays(ahora, -2);
    for (let skip = 0; ; skip += LOTE) {
        const lote = await repo.listarEnGraciaConFechaFinEn(inicioDiaUtc(diaGracia2), finDiaUtc(diaGracia2), { skip, take: LOTE });
        if (lote.length === 0) break;
        for (const s of lote) {
            eventosProgramados += await emitirEvento(EVENTOS_VIGENCIA.GRACIA_T_MAS_2, s, fechaTexto(s.fechaCorteProgramado));
        }
        if (lote.length < LOTE) break;
    }

    // 4c. suscripcion.freemium.T_menos_7 / T_menos_1 (freemium próximo a terminar).
    const finVentanaFreemiumUtc = finDiaUtc(addDays(ahora, 7));
    for (let skip = 0; ; skip += LOTE) {
        const lote = await repo.listarFreemiumEnVentana(inicioHoyUtc, finVentanaFreemiumUtc, { skip, take: LOTE });
        if (lote.length === 0) break;
        for (const s of lote) {
            if (!s.freemiumFechaFin) continue;
            const dias = diasCalendarioHasta(s.freemiumFechaFin, ahora);
            if (dias === 7) {
                eventosProgramados += await emitirEvento(EVENTOS_VIGENCIA.FREEMIUM_T_MENOS_7, s, fechaTexto(s.freemiumFechaFin));
            } else if (dias === 1) {
                eventosProgramados += await emitirEvento(EVENTOS_VIGENCIA.FREEMIUM_T_MENOS_1, s, fechaTexto(s.freemiumFechaFin));
            }
        }
        if (lote.length < LOTE) break;
    }

    // ── 5. Marca de idempotencia de la corrida ──
    await repo.guardarParametroVigencia(
        "pagos.vigencia.ultima_corrida",
        hoyISO,
        "Fecha (America/Bogota) de la última corrida efectiva del worker de vigencia de pagos"
    );

    console.warn(
        `[Vigencia] Corrida ${hoyISO}: ${transiciones.length} transiciones, ${eventosProgramados} notificaciones programadas`
    );
    return { transiciones, eventosProgramados, omitida: false };
}
