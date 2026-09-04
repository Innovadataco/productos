/**
 * SPEC-429 (A-75 · brief §9-bis · orden CEO 23:5x)
 *   GET  → devuelve la próxima encuesta pendiente del usuario autenticado
 *          (padre o profesional) o `null` cuando no le queda ninguna.
 *   POST → registra la respuesta {solicitudId, origen, respuestas} y cruza
 *          r1/r2 con el otro lado si ya respondió (posible incidente).
 *
 * Endpoint exento del propio guardián de encuesta (ver GUARDIAS_ACCESO.encuesta):
 * de lo contrario, quien está bloqueado no podría responder para desbloquearse.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import {
    proximaEncuestaPendiente,
    registrarRespuestaEncuesta,
    type RespuestasEncuesta,
} from "@/lib/profesional/cita/encuestas.service";
import {
    PREGUNTAS_PADRE,
    PREGUNTAS_PROFESIONAL,
} from "@/lib/profesional/cita/encuestas-preguntas";

export async function GET() {
    try {
        const user = await verifyAuth();
        const pendiente = await proximaEncuestaPendiente(user.id);
        if (!pendiente) return NextResponse.json({ data: null });
        const preguntas = pendiente.origen === "PADRE" ? PREGUNTAS_PADRE : PREGUNTAS_PROFESIONAL;
        return NextResponse.json({
            data: {
                solicitudId: pendiente.solicitudId,
                origen: pendiente.origen,
                preguntas,
            },
        });
    } catch (error) {
        return errorToResponse(error, "[ENCUESTA/GET]");
    }
}

const respuestasSchema = z.object({
    r1: z.string().min(1),
    r2: z.string().min(1),
    r3: z.string().min(1),
    r4: z.string().min(1),
    r5: z.string().min(1),
});

const bodySchema = z.object({
    solicitudId: z.string().min(1),
    origen: z.enum(["PADRE", "PROFESIONAL"]),
    respuestas: respuestasSchema,
});

export async function POST(request: Request) {
    try {
        const user = await verifyAuth();
        const body = bodySchema.parse(await request.json());
        const resultado = await registrarRespuestaEncuesta({
            solicitudId: body.solicitudId,
            usuarioId: user.id,
            origen: body.origen,
            respuestas: body.respuestas as RespuestasEncuesta,
        });
        return NextResponse.json({ data: resultado });
    } catch (error) {
        return errorToResponse(error, "[ENCUESTA/POST]");
    }
}
