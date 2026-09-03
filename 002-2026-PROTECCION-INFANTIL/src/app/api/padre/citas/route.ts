/**
 * SPEC-395 (L4) · Citas del padre.
 * GET  — lista de sus solicitudes (DTO con candado del contacto).
 * POST — crea una solicitud. Con `pagoHeredadoDeId` presente la vía es
 *        reasignación desde otra solicitud vencida (el pago se hereda).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { toCitaParaPadre } from "@/lib/profesional/cita/dto";
import { crearSolicitudCita } from "@/lib/profesional/cita/cita.service";

/** Porcentaje de comisión del sistema (aviso CEO: parametrizable después). */
const PORCENTAJE_SERVICIO_DEFAULT = 15;

const crearSchema = z.object({
    profesionalId: z.string().uuid(),
    franjaId: z.string().uuid(),
    presentacion: z.string().trim().min(20).max(2000),
    urgencia: z.enum(["ESTA_SEMANA", "SIN_APURO"]),
    expedienteCompartidoId: z.string().uuid().optional(),
    pagoHeredadoDeId: z.string().uuid().optional(),
});

export async function GET() {
    try {
        const user = await verifyAuth("PARENT");
        const solicitudes = await new SolicitudCitaRepository().listarPorPadre(user.id);
        return NextResponse.json({ data: solicitudes.map((s) => toCitaParaPadre(s)) });
    } catch (error) {
        return errorToResponse(error, "[PADRE/CITAS/GET]");
    }
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth("PARENT");
        const body = crearSchema.parse(await request.json());
        const solicitud = await crearSolicitudCita({
            padreUsuarioId: user.id,
            profesionalId: body.profesionalId,
            franjaId: body.franjaId,
            presentacion: body.presentacion,
            urgencia: body.urgencia,
            expedienteCompartidoId: body.expedienteCompartidoId ?? null,
            porcentajeServicio: PORCENTAJE_SERVICIO_DEFAULT,
            ...(body.pagoHeredadoDeId ? { pagoHeredadoDeId: body.pagoHeredadoDeId } : {}),
        });
        return NextResponse.json({ data: toCitaParaPadre(solicitud) });
    } catch (error) {
        return errorToResponse(error, "[PADRE/CITAS/POST]");
    }
}
