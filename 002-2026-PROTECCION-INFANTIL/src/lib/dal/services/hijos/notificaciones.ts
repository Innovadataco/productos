/**
 * SPEC-339 (A-67 · punto 4 de Calidad) — el cruce que hace ÚTIL el Paso 3.
 *
 * Hallazgo de Calidad, verificado: los identificadores de hijo no los leía
 * NADIE — el camino le exigía al padre un dato que no disparaba un solo aviso.
 * Este servicio cierra el circuito: reporte visible → hijos activos con ese
 * identificador activo → aviso al padre dueño.
 *
 * Regla de Jelkin: UN solo mecanismo de monitoreo, dos presentaciones. Este es
 * el mismo patrón del círculo (SPEC-135/308: trigger del worker, estados
 * visibles, apagador global, enfriamiento por usuario, correo por el motor) con
 * DOS diferencias deliberadas:
 *   1. Enfriamiento PROPIO (`ultimaNotificacionHijosEn`): reusar el del círculo
 *      haría que un aviso sobre un contacto vigilado silenciara 24h el aviso
 *      sobre el hijo. (El interruptor `notificacionesHijos` fue RETIRADO en
 *      SPEC-862 / I-395: el aviso del hijo es OBLIGATORIO y NO se puede silenciar
 *      —SPEC-683 / I-401, decisión de Jelkin—. El enfriamiento NO es un silencio:
 *      es anti-spam, no un opt-out.)
 *   2. Presentación propia: al padre no se le habla igual de «Carlos · tío» que
 *      de su hijo.
 */
// SPEC-197 (I-88): este módulo entra a la cadena de los workers — imports
// RELATIVOS, no alias @/lib (la allowlist del ratchet solo se encoge).
import { prisma } from "../../../prisma";
import { getParametroSistemaValor } from "../../../parametros";
import { enviarAlertaHijoReporte } from "../../../email";
import type { EstadoReporte } from "@prisma/client";
import { logger } from "../../../logger";
import { maskEmail } from "../../../mask-email";
import { ESTADOS_VISIBLES } from "../circulo-confianza/tipos";
// SPEC-863 (I-400): predicado canónico «reporte de prueba». Import RELATIVO (este módulo
// entra a la cadena de los workers, I-88/SPEC-197: la allowlist del ratchet solo se encoge).
import { esReporteNoReal } from "../../demo-exclusion";

/**
 * Evalúa si un reporte debe avisar a los padres cuyos HIJOS tienen ese
 * identificador. Cualquier error se captura y se registra sin interrumpir el
 * flujo del worker (mismo contrato que el círculo).
 */
export async function notificarHijosSiCorresponde(reporteId: string) {
    try {
        // SPEC-863 (I-400): un reporte de PRUEBA (simulacro/demo) NO avisa a un padre real.
        if (await esReporteNoReal(prisma, reporteId)) return;

        const reporte = await prisma.reporte.findUnique({
            where: { id: reporteId },
            select: {
                id: true,
                identificador: true,
                estado: true,
                eliminado: true,
                plataformaId: true,
                otraPlataforma: true,
            },
        });
        if (!reporte || reporte.eliminado) return;
        if (!ESTADOS_VISIBLES.includes(reporte.estado as EstadoReporte)) return;

        // Apagador global del mecanismo de monitoreo (compartido con el
        // círculo a propósito: es el freno de emergencia del ADMIN, no la
        // preferencia del padre).
        if ((await getParametroSistemaValor("circulo.notificaciones.enabled")) === "false") return;

        // Enfriamiento PROPIO del frente hijos; el parámetro del círculo se
        // reusa como valor por defecto del mecanismo.
        const cooldownHoras = parseInt(
            (await getParametroSistemaValor("circulo.notificaciones.cooldown_horas")) || "24",
            10
        );
        const cooldownMs = (Number.isNaN(cooldownHoras) ? 24 : cooldownHoras) * 60 * 60 * 1000;
        const ahora = new Date();

        // SPEC-339 (D-4): la ficha tiene dueño directo — un aviso por padre.
        const hijos = await prisma.hijo.findMany({
            where: {
                estado: "activo",
                // I-429: el cruce es por el PAR (identificador, plataforma) — una sola verdad con
                // `tieneReportes` y «A quién protejo». `Reporte.plataformaId` es NOT NULL; un
                // identificador sin plataforma (null) no matchea (no se puede afirmar «misma red»).
                identificadores: { some: { valor: reporte.identificador, plataformaId: reporte.plataformaId, activo: true } },
            },
            select: {
                id: true,
                nombre: true,
                usuario: {
                    select: {
                        id: true,
                        email: true,
                        ultimaNotificacionHijosEn: true,
                    },
                },
                identificadores: {
                    where: { valor: reporte.identificador, activo: true },
                    select: { plataforma: { select: { nombre: true } } },
                    take: 1,
                },
            },
        });
        if (hijos.length === 0) return;

        const avisados = new Set<string>();
        for (const hijo of hijos) {
            const padre = hijo.usuario;
            if (avisados.has(padre.id)) continue;
            // SPEC-862 / I-395: el gate `if (!padre.notificacionesHijos) continue` fue
            // RETIRADO. El aviso del hijo es OBLIGATORIO (SPEC-683 / I-401): no hay opt-out
            // por estructura — el servicio ni siquiera lee el campo. El único salto que
            // queda es el enfriamiento anti-spam de abajo (no es un silencio).
            if (
                padre.ultimaNotificacionHijosEn &&
                ahora.getTime() - padre.ultimaNotificacionHijosEn.getTime() < cooldownMs
            ) {
                logger.info(`[HIJOS] Aviso omitido: padre ${padre.id} en enfriamiento`);
                continue;
            }

            logger.info(`[HIJOS] Enviando aviso a ${maskEmail(padre.email)} (hijo ${hijo.id})`);
            await enviarAlertaHijoReporte({
                destinatario: { usuarioId: padre.id, email: padre.email },
                reporteId: reporte.id,
                // Solo el primer nombre: el correo no necesita más PII del menor.
                nombreHijo: hijo.nombre.split(" ")[0],
                identificador: reporte.identificador,
                plataforma: hijo.identificadores[0]?.plataforma?.nombre ?? null,
            });

            await prisma.usuario.update({
                where: { id: padre.id },
                data: { ultimaNotificacionHijosEn: ahora },
            });
            avisados.add(padre.id);
        }
    } catch (error) {
        logger.error("[HIJOS] Error enviando aviso de hijo:", error);
    }
}
