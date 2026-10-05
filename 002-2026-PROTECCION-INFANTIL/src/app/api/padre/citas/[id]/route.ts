/**
 * SPEC-428 · GET /api/padre/citas/[id] — detalle de una cita del padre para
 * la pantalla de espera con reloj de 48 h.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { toCitaParaPadre } from "@/lib/profesional/cita/dto";
import { peticionDeCitaAbierta } from "@/lib/dal/services/soporte/peticion-servicio.service";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("PARENT");
        const { id } = await ctx.params;
        const cita = await new SolicitudCitaRepository().findParaPadre(id, user.id);
        if (!cita) {
            throw new AppError("Cita no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }
        // SPEC-864: mismo cálculo que el SSR del detalle — la PQR «no cumplió» abierta de esta cita
        // (solo en CONFIRMADA, §2.7). Sin esto, el refresco al foco del panel devolvería el campo en
        // `null` y el marcador «ya nos avisaste» desaparecería (reapareciendo el disparador).
        const peticionCitaAbierta =
            cita.estado === "CONFIRMADA" ? await peticionDeCitaAbierta(cita.id, user.id) : null;
        return NextResponse.json({ data: toCitaParaPadre(cita, new Date(), { peticionCitaAbierta }) });
    } catch (error) {
        return errorToResponse(error, "[PADRE/CITAS/GET]");
    }
}
