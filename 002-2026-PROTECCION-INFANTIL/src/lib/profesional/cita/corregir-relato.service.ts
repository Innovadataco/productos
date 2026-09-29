/**
 * SPEC-780 · Rectificación del relato de la cita (`SolicitudCita.presentacion`) — habeas data
 * (Ley 1581). Camino SANCIONADO: lo ejecuta un operador/admin (no autoservicio del padre, nunca
 * a mano en la base). Corrige la solicitud VIVA; el historial NO se reescribe.
 *
 * Historial = filas de una cadena de reprogramación que tienen SUCESOR. No son copias rancias:
 * son el registro de un pedido DISTINTO (en la fecha D el padre pidió una cita diciendo X — y eso
 * es verdad, aunque hoy corrija su relato). Corregirlas las volvería FALSAS, y un profesional ya
 * actuó sobre lo que leyó entonces. [INTERPRETACIÓN legal del CEO → tensión al abogado: «¿la
 * rectificación alcanza a los registros históricos de pedidos anteriores?». Si el abogado dice
 * otra cosa, cambia la CONDUCTA, no solo el texto — ver specs/780/spec.md.]
 *
 * Rastro: se registra el HECHO (que hubo corrección y cuándo), NUNCA el texto — ni el anterior ni
 * el nuevo — para que nada del relato viaje a `bi_replica`/`AuditLog.metadatos`
 * (`ceo-cifrar-el-campo-no-cifra-sus-derivados`).
 */
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";

export interface CorregirRelatoInput {
    solicitudId: string;
    presentacion: string;
    /** Snapshot del operador/admin que ejecuta (NO FK, lección #727: el rastro sobrevive a la baja). */
    actorId: string;
}

export async function corregirRelatoCita(input: CorregirRelatoInput): Promise<{ corregidoEn: Date }> {
    const repo = new SolicitudCitaRepository();
    const sol = await repo.findParaCorreccionRelato(input.solicitudId);
    if (!sol) throw new AppError("Cita no encontrada", ERROR_CODES.NOT_FOUND, 404);

    // La corrección es SOLO de la fila viva. Una fila con sucesor es historial (un pedido
    // anterior de la cadena de reprogramación): corregirla reescribiría lo que se dijo entonces.
    if (sol._count.reprogramaciones > 0) {
        throw new AppError(
            "Esta versión de la cita ya fue reprogramada: queda como el registro de lo que se pidió entonces y no se corrige. Corrige la cita vigente.",
            ERROR_CODES.VALIDATION_ERROR,
            400,
        );
    }

    await repo.corregirRelato(input.solicitudId, input.presentacion);
    const corregidoEn = new Date();

    // HECHO, no contenido: sin volcar el texto (ni anterior ni nuevo) a nada replicado.
    await logAudit({
        accion: "CITA_PROFESIONAL_RELATO_CORREGIDO",
        tipoRecurso: "SolicitudCita",
        recursoId: input.solicitudId,
        usuarioId: input.actorId,
        metadatos: { hecho: "relato_corregido" },
    });

    return { corregidoEn };
}
