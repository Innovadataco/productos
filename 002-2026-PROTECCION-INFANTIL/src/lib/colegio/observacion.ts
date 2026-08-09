/**
 * SPEC-150 (FR-002) — Observación especial del estudiante.
 *
 * Marcar y desmarcar escriben la fila Y el audit en LA MISMA transacción
 * (withUnitOfWork): un fallo a mitad deja 0 rastros — la marca es auditable
 * por diseño (Ley 1581). Marcar es IDEMPOTENTE (re-marca devuelve la activa
 * existente sin duplicar ni re-auditar); desmarcar es SOFT DELETE que CONSERVA
 * la fila con quién/cuándo. El audit lleva solo metadatos (nunca el motivo).
 *
 * I-28/I-29: nada de esto incluye textos de reportes ni identificadores.
 */
import { logAudit } from "@/lib/audit";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { EstudianteObservacionRepository } from "@/lib/dal/repositories/estudiante-observacion";
import type { EstudianteObservacionRow } from "@/lib/dal/repositories/estudiante-observacion";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";

function clientInfo(request?: Request): { ipAddress: string; userAgent: string } {
    return {
        ipAddress: request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown",
        userAgent: request?.headers.get("user-agent") || "unknown",
    };
}

/**
 * Marca al estudiante (idempotente): crea la observación + audit
 * `COLEGIO_OBSERVACION_MARCADA` en una tx. Si ya hay una activa devuelve la
 * existente (`creada=false`) SIN duplicar ni auditar de nuevo.
 */
export async function marcarObservacionEspecial(
    colegioId: string,
    estudianteId: string,
    usuarioId: string,
    motivo: string | undefined,
    request?: Request
): Promise<{ creada: boolean; observacion: EstudianteObservacionRow }> {
    const { ipAddress, userAgent } = clientInfo(request);
    return withUnitOfWork(async (tx) => {
        const resultado = await new EstudianteObservacionRepository(tx).marcar(colegioId, estudianteId, {
            creadaPorId: usuarioId,
            motivo,
        });
        if (resultado.creada) {
            await logAudit({
                accion: "COLEGIO_OBSERVACION_MARCADA",
                tipoRecurso: "EstudianteObservacion",
                recursoId: resultado.observacion.id,
                usuarioId,
                colegioId,
                valorNuevo: JSON.stringify({ estudianteId }),
                ipAddress,
                userAgent,
                tx,
            });
        }
        return resultado;
    });
}

/**
 * Desmarca con soft delete + audit `COLEGIO_OBSERVACION_DESMARCADA` en una tx
 * (la fila queda conservada con fecha y actor). Null si no había activa.
 */
export async function desmarcarObservacionEspecial(
    colegioId: string,
    estudianteId: string,
    usuarioId: string,
    request?: Request
): Promise<EstudianteObservacionRow | null> {
    const { ipAddress, userAgent } = clientInfo(request);
    return withUnitOfWork(async (tx) => {
        const desactivada = await new EstudianteObservacionRepository(tx).desmarcar(colegioId, estudianteId, usuarioId);
        if (desactivada) {
            await logAudit({
                accion: "COLEGIO_OBSERVACION_DESMARCADA",
                tipoRecurso: "EstudianteObservacion",
                recursoId: desactivada.id,
                usuarioId,
                colegioId,
                valorAnterior: JSON.stringify({ estudianteId, activa: true }),
                valorNuevo: JSON.stringify({ estudianteId, activa: false }),
                ipAddress,
                userAgent,
                tx,
            });
        }
        return desactivada;
    });
}

/** Vista de una marca para la ficha (actor legible, fechas ISO). */
export interface ObservacionVista {
    id: string;
    activa: boolean;
    motivo: string | null;
    creadaPor: string;
    createdAt: string;
    desactivadaEn: string | null;
    desactivadaPor: string | null;
}

/**
 * Estado + histórico COMPLETO de la observación del estudiante (activas e
 * inactivas, reciente primero), con los actores resueltos a nombre/email en
 * UNA consulta adicional (cero N+1).
 */
export async function obtenerEstadoObservacion(
    colegioId: string,
    estudianteId: string
): Promise<{ activa: ObservacionVista | null; historial: ObservacionVista[] }> {
    const filas = await new EstudianteObservacionRepository().historial(colegioId, estudianteId);

    const actorIds = [...new Set(filas.flatMap((f) => [f.creadaPorId, f.desactivadaPorId].filter((x): x is string => x !== null)))];
    const actores = actorIds.length > 0 ? await new UsuarioRepository().findInfoPorIds(actorIds) : [];
    const nombrePorId = new Map(actores.map((a) => [a.id, a.nombre?.trim() || a.email]));

    const historial: ObservacionVista[] = filas.map((f) => ({
        id: f.id,
        activa: f.activa,
        motivo: f.motivo,
        creadaPor: nombrePorId.get(f.creadaPorId) ?? "Usuario no disponible",
        createdAt: f.createdAt.toISOString(),
        desactivadaEn: f.desactivadaEn?.toISOString() ?? null,
        desactivadaPor: f.desactivadaPorId ? (nombrePorId.get(f.desactivadaPorId) ?? "Usuario no disponible") : null,
    }));

    return { activa: historial.find((o) => o.activa) ?? null, historial };
}
