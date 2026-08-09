/**
 * SPEC-149 (FR-005) — Resumen semanal del colegio (schedule `colegio-resumen-semanal`,
 * lunes 07:00 America/Bogota, molde `apelacion-mantenimiento`).
 *
 * UN email por colegio con RESUMEN_SEMANAL habilitado (default: habilitado —
 * la calma se muestra, §4.0.1) con: reportes de la semana (métrica D2), lo que
 * "te espera" (embudo de SPEC-158) y los eventos que el tope diario guardó
 * (PENDIENTE_DIGEST — nunca se pierden: salen aquí y quedan entregados).
 * Idempotente por semana: clave (colegioId, RESUMEN_SEMANAL, "semanal",
 * dia=lunes) sobre la MISMA constraint del RegistroAvisoColegio — si el worker
 * cae y pg-boss reintenta, la segunda corrida es no-op.
 * Cero PII: solo conteos agregados del propio colegio (I-29).
 */
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { enviarResumenSemanalColegio } from "@/lib/email";
import { AlertaColegioRepository } from "@/lib/dal/repositories/alerta-colegio";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";
import { RegistroAvisoColegioRepository } from "@/lib/dal/repositories/registro-aviso-colegio";
import { obtenerPreferenciaEfectiva, resolverEmailDestino, inicioSemanaBogota, diaBogota } from "./avisos";

const DIA_MS = 24 * 60 * 60 * 1000;
const ENTIDAD_SEMANAL = "semanal";

export interface ResultadoResumenSemanal {
    colegioId: string;
    resultado: "enviado" | "omitido" | "fallido";
    motivo: string;
}

/** Resumen de UN colegio para la semana de `ahora`. Nunca lanza: devuelve el resultado. */
export async function enviarResumenSemanalDeColegio(colegioId: string, ahora: Date = new Date()): Promise<ResultadoResumenSemanal> {
    const lunes = inicioSemanaBogota(ahora);
    const registros = new RegistroAvisoColegioRepository();
    const clave = { colegioId, tipoEvento: "RESUMEN_SEMANAL" as const, entidadId: ENTIDAD_SEMANAL, dia: lunes };

    try {
        const existente = await registros.buscar(clave);
        if (existente && existente.estado !== "FALLIDO") {
            return { colegioId, resultado: "omitido", motivo: "duplicado" };
        }

        const pref = await obtenerPreferenciaEfectiva(colegioId, "RESUMEN_SEMANAL");
        if (!pref.habilitado) {
            await registros.registrarSiAusente(clave, "OMITIDO", "resumen semanal deshabilitado por el colegio");
            return { colegioId, resultado: "omitido", motivo: "omitido_preferencia" };
        }

        const email = await resolverEmailDestino(colegioId, pref.emailDestino);
        if (!email) {
            await registros.registrarSiAusente(clave, "OMITIDO", "sin destinatario configurado");
            return { colegioId, resultado: "omitido", motivo: "sin_destinatario" };
        }

        const alertas = new AlertaColegioRepository();
        const hace7d = new Date(ahora.getTime() - 7 * DIA_MS);
        const [reportesSemana, embudo, pendientes] = await Promise.all([
            alertas.contarReportesDistintos(colegioId, hace7d),
            alertas.embudoPorReporte(colegioId),
            registros.pendientesDigest(colegioId),
        ]);

        try {
            await enviarResumenSemanalColegio(email, {
                reportesSemana,
                teEsperan: embudo.teEsperan,
                pendientesDigest: pendientes.length,
            });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (existente) {
                await registros.actualizarEstado(existente.id, "FALLIDO", msg.slice(0, 500));
            } else {
                await registros.registrarSiAusente(clave, "FALLIDO", msg.slice(0, 500));
            }
            logger.error(`[COLEGIO/RESUMEN] Error enviando resumen a colegio ${colegioId}:`, error);
            return { colegioId, resultado: "fallido", motivo: msg };
        }

        // ENVIADO solo tras el éxito del proveedor; los pendientes de digest ya
        // entregados en este resumen se marcan para no repetirlos el próximo lunes.
        if (existente) {
            await registros.actualizarEstado(existente.id, "ENVIADO");
        } else {
            await registros.registrarSiAusente(clave, "ENVIADO");
        }
        if (pendientes.length > 0) {
            await registros.marcarDigestComoEnviados(
                colegioId,
                pendientes.map((p) => p.id),
                `incluido en resumen semanal ${lunes.toISOString().slice(0, 10)}`
            );
        }

        await logAudit({
            accion: "COLEGIO_AVISO_ENVIADO",
            tipoRecurso: "RegistroAvisoColegio",
            colegioId,
            valorNuevo: JSON.stringify({
                tipoEvento: "RESUMEN_SEMANAL",
                semana: lunes.toISOString().slice(0, 10),
                reportesSemana,
                teEsperan: embudo.teEsperan,
                pendientesDigest: pendientes.length,
            }),
            ipAddress: "worker",
            userAgent: "worker",
        });
        return { colegioId, resultado: "enviado", motivo: "enviado" };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[COLEGIO/RESUMEN] Error procesando resumen de colegio ${colegioId}:`, error);
        return { colegioId, resultado: "fallido", motivo: msg };
    }
}

/**
 * Handler del schedule semanal: recorre los colegios activos y vigentes. Un
 * fallo de un colegio NO detiene a los demás (molde apelacion-mantenimiento).
 */
export async function enviarResumenesSemanales(ahora: Date = new Date()): Promise<{ enviados: number; omitidos: number; fallidos: number }> {
    const colegios = await new ColegioRepository().listarIdsActivosVigentes(ahora);

    let enviados = 0;
    let omitidos = 0;
    let fallidos = 0;
    for (const colegio of colegios) {
        const resultado = await enviarResumenSemanalDeColegio(colegio.id, ahora);
        if (resultado.resultado === "enviado") enviados++;
        else if (resultado.resultado === "omitido") omitidos++;
        else fallidos++;
    }

    logger.info(
        `[COLEGIO/RESUMEN] Resúmenes semanales del ${diaBogota(ahora).toISOString().slice(0, 10)}: ${enviados} enviados, ${omitidos} omitidos, ${fallidos} fallidos (${colegios.length} colegios)`
    );
    return { enviados, omitidos, fallidos };
}
