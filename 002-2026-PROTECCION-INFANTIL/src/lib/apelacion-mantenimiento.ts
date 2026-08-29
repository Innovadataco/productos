import { subDays } from "date-fns";
import { diaCalendarioBogota } from "./fechas/formato-bogota";
import { prisma } from "./prisma";
import { logAudit } from "./audit";
import { logger } from "./logger";
import { getAvisoPrevioDias, getRetencionDocumentoDias, diasHabilesTranscurridos } from "./apelaciones";
import { eliminarDocumentoCifrado } from "./apelacion-storage";
import { enviarAvisoPlazoApelaciones } from "./email";

/**
 * SPEC-110 — Mantenimiento diario de apelaciones (job pg-boss `apelacion-mantenimiento`).
 *
 * Dos responsabilidades, ambas parametrizadas (ADR_004) y con AuditLog permanente:
 * - Purga de evidencia: borra el `.enc` de los documentos de apelaciones resueltas hace
 *   ≥ `apelacion.retencion_documento_dias` (default 30) días. Conserva los metadatos
 *   (que hubo documento, hash, tamaño) y la traza de accesos: auditoría sin el dato sensible.
 * - Aviso de plazo: email digest al comité de los casos sin resolver con ≥
 *   `apelacion.aviso_previo_dias` (default 10) días hábiles. El fallo de email no
 *   bloquea la purga (warn y reintento en la siguiente corrida).
 */

export async function purgarDocumentosVencidos(ahora: Date = new Date()): Promise<number> {
    const retencionDias = await getRetencionDocumentoDias();
    // SPEC-200: el corte de retención se fija sobre el día calendario Bogotá.
    const limite = subDays(diaCalendarioBogota(ahora), retencionDias);

    const vencidos = await prisma.documentoApelacion.findMany({
        where: {
            eliminadoEn: null,
            apelacion: { resueltoEn: { not: null, lte: limite } },
        },
        select: {
            id: true,
            rutaArchivo: true,
            apelacionId: true,
            apelacion: { select: { numero: true, resueltoEn: true } },
        },
    });

    let purgados = 0;
    for (const doc of vencidos) {
        await eliminarDocumentoCifrado(doc.rutaArchivo);
        await prisma.documentoApelacion.update({ where: { id: doc.id }, data: { eliminadoEn: ahora } });
        await logAudit({
            accion: "APELACION_DOCUMENTO_PURGADO",
            tipoRecurso: "DocumentoApelacion",
            recursoId: doc.id,
            valorNuevo: JSON.stringify({
                apelacionId: doc.apelacionId,
                numero: doc.apelacion.numero,
                resueltoEn: doc.apelacion.resueltoEn,
                retencionDias,
            }),
            ipAddress: "job",
            userAgent: "apelacion-mantenimiento",
        });
        purgados++;
    }
    if (purgados > 0) {
        logger.info(`[Apelaciones] Purga: ${purgados} documento(s) eliminados (retención=${retencionDias}d)`);
    }
    return purgados;
}

export async function procesarAvisosPlazo(ahora: Date = new Date()): Promise<number> {
    const avisoDias = await getAvisoPrevioDias();
    const abiertas = await prisma.apelacion.findMany({
        where: { estado: { in: ["RECIBIDA", "EN_REVISION"] } },
        select: { id: true, numero: true, creadoEn: true },
    });

    const enAviso = abiertas
        .map((a) => ({ numero: a.numero, diasHabiles: diasHabilesTranscurridos(a.creadoEn, ahora) }))
        .filter((c) => c.diasHabiles >= avisoDias);

    if (enAviso.length === 0) return 0;

    const comite = await prisma.usuario.findMany({
        where: { rol: "COMITE_VALIDACION", estado: "activo" },
        select: { email: true },
    });
    if (comite.length === 0) {
        logger.warn("[Apelaciones] Aviso de plazo: no hay miembros activos del comité");
        return 0;
    }

    let enviados = 0;
    for (const miembro of comite) {
        try {
            await enviarAvisoPlazoApelaciones(miembro.email, enAviso);
            enviados++;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn(`[Apelaciones] Aviso de plazo: fallo de email a ${miembro.email} — ${msg}`);
        }
    }

    await logAudit({
        accion: "APELACION_AVISO_PLAZO",
        tipoRecurso: "Apelacion",
        valorNuevo: JSON.stringify({ casos: enAviso, destinatarios: comite.length, enviados, avisoDias }),
        ipAddress: "job",
        userAgent: "apelacion-mantenimiento",
    });
    logger.info(`[Apelaciones] Aviso de plazo: ${enAviso.length} caso(s), ${enviados}/${comite.length} email(s) enviados`);
    return enAviso.length;
}

export async function ejecutarMantenimientoApelaciones(ahora: Date = new Date()): Promise<{ avisos: number; purgados: number }> {
    const avisos = await procesarAvisosPlazo(ahora);
    const purgados = await purgarDocumentosVencidos(ahora);
    return { avisos, purgados };
}
