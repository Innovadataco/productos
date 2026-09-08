import { prisma } from "@/lib/prisma";
import { actorActual } from "@/lib/auditoria-lectura/actor";
import { hashContenidoVisto } from "@/lib/acceso-codigo";
import { programar } from "@/lib/notificaciones";
import { logger } from "@/lib/logger";
import type { CampoContenido } from "@/lib/reporte-texto-llaves";

/**
 * SPEC-584 (Fase 2) · Escritura de la auditoría de lectura del texto del reporte.
 *
 * La frontera del descifrado (`descifrar-contenido.ts`) llama acá por CADA campo
 * descifrado que se devuelve a un lector. Se registra: quién (actor del hilo ALS),
 * qué campo, a qué contenido pertenece y el sha-256 del texto visto — NUNCA el
 * texto literal (decisión 1a del dueño, 2026-09-07).
 *
 * La escritura de la auditoría es FAIL-LOUD: el descifrado ya exige la base de
 * datos, así que si no se puede dejar rastro la lectura no debe completarse en
 * silencio (decisión 7: "cada visualización genera registro"). La NOTIFICACIÓN al
 * padre, en cambio, es lo más parecido a best-effort: jamás tumba la lectura.
 */

/** Datos del dueño del contenido, resueltos por la frontera antes de registrar. */
export interface DuenoContenido {
    reporteId?: string;
    eventoId?: string;
    /** Usuario autenticado dueño del reporte (null/undefined = reporte anónimo). */
    duenoUsuarioId?: string | null;
    /** Identificador reportado (para el correo al padre; sin PII del relato). */
    identificador?: string;
}

const EVENTO_TEXTO_LEIDO = "padre.reporte.texto_leido";

/**
 * Registra una lectura de un campo cifrado. Lanza si la auditoría no se puede
 * escribir (fail-loud); la notificación al padre dueño nunca lanza.
 */
export async function registrarLecturaTexto(
    contenidoId: string,
    campo: CampoContenido,
    textoVisto: string,
    dueno: DuenoContenido
): Promise<void> {
    const actor = actorActual();
    await prisma.lecturaReporte.create({
        data: {
            contenidoId,
            campo,
            reporteId: dueno.reporteId ?? null,
            eventoId: dueno.eventoId ?? null,
            tipoActor: actor?.tipoActor ?? "PLATAFORMA",
            usuarioId: actor?.usuarioId ?? null,
            rol: actor?.rol ?? null,
            codigoAccesoId: actor?.codigoAccesoId ?? null,
            hashContenido: hashContenidoVisto(textoVisto),
            ip: actor?.ip ?? null,
            userAgent: actor?.userAgent ?? null,
        },
    });

    // Decisión 5 (dueño, 2026-09-07): cada lectura por plataforma notifica al padre
    // dueño del reporte. Solo aplica a reportes con dueño autenticado: el reporte
    // ANÓNIMO no tiene padre y jamás genera notificación (decisión 6). Las
    // lecturas EXTERNAS (sesión por código) tampoco notifican acá — el canje ya
    // avisó al solicitante.
    if ((actor?.tipoActor ?? "PLATAFORMA") !== "PLATAFORMA") return;
    if (!dueno.reporteId || !dueno.duenoUsuarioId) return;

    try {
        const resultado = await programar({
            evento: EVENTO_TEXTO_LEIDO,
            sujetoTipo: "Reporte",
            sujetoId: dueno.reporteId,
            destinatarios: [
                {
                    usuarioId: dueno.duenoUsuarioId,
                    rol: "PARENT",
                    variables: {
                        identificador: dueno.identificador ?? "tu reporte",
                        campo: campo === "textoOriginal" ? "texto original" : "texto",
                        rolLector: actor?.rol ?? "PLATAFORMA",
                        fechaLectura: new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }),
                    },
                },
            ],
        });
        if (resultado.programadas === 0) {
            logger.info(
                `[AuditoriaLectura] Sin regla activa para ${EVENTO_TEXTO_LEIDO} (reporte=${dueno.reporteId}); la lectura quedó auditada igual.`
            );
        }
    } catch (error) {
        logger.error("[AuditoriaLectura] Error notificando al padre dueño (la lectura quedó auditada):", error);
    }
}
