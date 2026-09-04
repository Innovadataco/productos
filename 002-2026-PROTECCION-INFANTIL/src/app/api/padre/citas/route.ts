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
import { cuidIdSchema } from "@/lib/schemas/base";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { toCitaParaPadre } from "@/lib/profesional/cita/dto";
// SPEC-403 (I-288): el porcentaje es PARÁMETRO, no constante. El admin lo
// cambia sin desplegar y el panel del profesional lee el mismo número.
import { obtenerPorcentajeServicio } from "@/lib/profesional/cita/comision";
import { crearSolicitudCita } from "@/lib/profesional/cita/cita.service";
import { leerPrecioEstandarPrimeraCita } from "@/lib/profesional/cita/precio-primera-cita";

// SPEC-444 (I-310): todos los modelos de PI generan ids con @default(cuid()).
// Validar con uuid() rechazaba el id real y dejaba la ruta en 400 permanente.
const crearSchema = z.object({
    profesionalId: cuidIdSchema,
    franjaId: cuidIdSchema,
    presentacion: z.string().trim().min(20).max(2000),
    urgencia: z.enum(["ESTA_SEMANA", "SIN_APURO"]),
    expedienteCompartidoId: cuidIdSchema.optional(),
    pagoHeredadoDeId: cuidIdSchema.optional(),
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
        // SPEC-428 §4: la 1ª cita cobra al PRECIO ESTÁNDAR del admin, no a
        // la tarifa del profesional. Solo se inyecta cuando NO se hereda un
        // pago (la reasignación reusa el monto original — regla del brief).
        const montoConsultaOverride = body.pagoHeredadoDeId
            ? undefined
            : await leerPrecioEstandarPrimeraCita();
        const solicitud = await crearSolicitudCita({
            padreUsuarioId: user.id,
            profesionalId: body.profesionalId,
            franjaId: body.franjaId,
            presentacion: body.presentacion,
            urgencia: body.urgencia,
            expedienteCompartidoId: body.expedienteCompartidoId ?? null,
            porcentajeServicio: await obtenerPorcentajeServicio(),
            ...(montoConsultaOverride !== undefined ? { montoConsultaOverride } : {}),
            ...(body.pagoHeredadoDeId ? { pagoHeredadoDeId: body.pagoHeredadoDeId } : {}),
        });
        return NextResponse.json({ data: toCitaParaPadre(solicitud) });
    } catch (error) {
        return errorToResponse(error, "[PADRE/CITAS/POST]");
    }
}
