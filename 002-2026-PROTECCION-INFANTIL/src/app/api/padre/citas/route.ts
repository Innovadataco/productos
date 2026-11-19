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
import { cotizarCitaNueva, MENSAJE_TOTAL_CAMBIO } from "@/lib/profesional/cita/cotizacion-cita";
import { AppError, ERROR_CODES } from "@/lib/errors";

// SPEC-444 (I-310): todos los modelos de PI generan ids con @default(cuid()).
// Validar con uuid() rechazaba el id real y dejaba la ruta en 400 permanente.
const crearSchema = z.object({
    profesionalId: cuidIdSchema,
    franjaId: cuidIdSchema,
    // SPEC-729 §3: mínimo ÚNICO = 10 (igual que el perfil). En protección no se
    // rechaza la descripción breve y real de un padre («Acoso a mi hija» = 15). La
    // presentación es un solo campo (presentacionEstandar, max 500): se alinea acá.
    presentacion: z.string().trim().min(10).max(500),
    urgencia: z.enum(["ESTA_SEMANA", "SIN_APURO"]),
    expedienteCompartidoId: cuidIdSchema.optional(),
    pagoHeredadoDeId: cuidIdSchema.optional(),
    // SPEC-934 (I-450): el TOTAL que el padre vio y aceptó (consulta + servicio de la red). Si ya no es el
    // vigente (el admin cambió la comisión o el precio entre ver y confirmar), se rechaza: nunca se guarda
    // un monto distinto del que aceptó.
    totalEsperado: z.number().int().positive().optional(),
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
        // SPEC-934: la cotización es la MISMA que pinta la ficha/el modal (`cotizarCitaNueva`).
        const cotizacion = body.pagoHeredadoDeId ? null : await cotizarCitaNueva();
        if (cotizacion && body.totalEsperado !== undefined && body.totalEsperado !== cotizacion.pagaElPadre) {
            throw new AppError(MENSAJE_TOTAL_CAMBIO, ERROR_CODES.CONFLICT, 409);
        }
        const montoConsultaOverride = cotizacion?.tarifaProfesional;
        const solicitud = await crearSolicitudCita({
            padreUsuarioId: user.id,
            profesionalId: body.profesionalId,
            franjaId: body.franjaId,
            presentacion: body.presentacion,
            urgencia: body.urgencia,
            expedienteCompartidoId: body.expedienteCompartidoId ?? null,
            porcentajeServicio: cotizacion?.porcentajeServicio ?? (await obtenerPorcentajeServicio()),
            ...(montoConsultaOverride !== undefined ? { montoConsultaOverride } : {}),
            ...(body.pagoHeredadoDeId ? { pagoHeredadoDeId: body.pagoHeredadoDeId } : {}),
        });
        return NextResponse.json({ data: toCitaParaPadre(solicitud) });
    } catch (error) {
        return errorToResponse(error, "[PADRE/CITAS/POST]");
    }
}
