/**
 * SPEC-784 · La encuesta de servicio de la cita, sobre el modelo TIPADO de 753.
 *   GET  → las citas del usuario con encuesta pendiente PARA ÉL (fuente única: `citasConEncuestaPendiente`).
 *   POST → registra la fila `EncuestaCita` con los ENUMS de 753 y CRUZA con el otro lado (753 service).
 *
 * Cambios sobre #341 (que guardaba `r1..r5` de texto libre):
 *  - El `origen` (PADRE/PROFESIONAL) NO viene del cuerpo: se DERIVA del rol autenticado y se verifica la
 *    PARTICIPACIÓN en la cita. #341 lo tomaba del body — un padre podía enviarse como PROFESIONAL.
 *  - Coherencia del CHECK VALIDADO como defensa en profundidad: razón sii NO se realizó; duración sii SÍ
 *    (la UI ya lo hace imposible por estructura — FR-3; acá es la red de atrás).
 *  - 2º envío del mismo lado → 409 (`@@unique([solicitudId, origen])`), no 500.
 *
 * Exento (a cablear en T5, con el gate de página): quien tiene encuesta pendiente debe poder llegar a
 * ESTE endpoint para responderla — la compuerta no puede taparlo, o el usuario queda trabado.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import {
    Prisma,
    OperadorConvoco,
    InicioSesion,
    EnlaceFunciono,
    DuracionSesion,
    RazonNoSesion,
} from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { cruzarEncuestasCita } from "@/lib/profesional/cita/encuestas-cita-cruce.service";
import {
    citasConEncuestaPendiente,
    esEncuestaPendientePara,
    origenParaRol,
} from "@/lib/profesional/cita/encuesta-pendiente";
import { estadoEfectivoDeCita } from "@/lib/profesional/cita/estado-efectivo";

export async function GET() {
    try {
        const user = await verifyAuth();
        const pendientes = await citasConEncuestaPendiente(user.id, user.rol, new Date(), prisma);
        return NextResponse.json({ data: { pendientes } });
    } catch (error) {
        return errorToResponse(error, "[ENCUESTA/GET]");
    }
}

/**
 * Cuerpo del envío. Q1 (`seRealizo`) + Q3/Q4/Q5 (`operador`/`inicio`/`enlace`) siempre; la razón y la
 * duración son condicionales y su presencia la fija la coherencia P1 (el `refine`), espejo del CHECK.
 */
const bodySchema = z
    .object({
        solicitudId: z.string().min(1),
        seRealizo: z.boolean(),
        operador: z.nativeEnum(OperadorConvoco),
        inicio: z.nativeEnum(InicioSesion),
        enlace: z.nativeEnum(EnlaceFunciono),
        razonNoRealizo: z.nativeEnum(RazonNoSesion).optional(),
        duracion: z.nativeEnum(DuracionSesion).optional(),
    })
    .refine(
        (b) =>
            b.seRealizo
                ? b.duracion !== undefined && b.razonNoRealizo === undefined
                : b.razonNoRealizo !== undefined && b.duracion === undefined,
        {
            message:
                "Coherencia: la duración va SÓLO si se realizó la sesión, y la razón SÓLO si no se realizó.",
        },
    );

export async function POST(request: Request) {
    try {
        const user = await verifyAuth();
        const origen = origenParaRol(user.rol);
        if (!origen) {
            throw new AppError("Tu rol no responde encuestas de cita.", ERROR_CODES.FORBIDDEN, 403);
        }
        const body = bodySchema.parse(await request.json());

        // Participación + estado: sólo el padre o el profesional de ESA cita, y sólo cuando la cita
        // pide encuesta (defensa: no aceptar la de una cita futura o sin sesión que reportar).
        const solicitud = await prisma.solicitudCita.findUnique({
            where: { id: body.solicitudId },
            select: {
                estado: true,
                padreUsuarioId: true,
                franja: { select: { inicio: true, fin: true } },
                profesional: { select: { usuarioId: true } },
            },
        });
        if (!solicitud) {
            throw new AppError("Cita no encontrada.", ERROR_CODES.NOT_FOUND, 404);
        }
        const participa =
            origen === "PADRE"
                ? solicitud.padreUsuarioId === user.id
                : solicitud.profesional.usuarioId === user.id;
        if (!participa) {
            throw new AppError("No participás en esta cita.", ERROR_CODES.FORBIDDEN, 403);
        }
        const estadoEfectivo = estadoEfectivoDeCita(
            solicitud.estado,
            solicitud.franja.inicio,
            solicitud.franja.fin,
            new Date(),
        );
        if (!esEncuestaPendientePara(estadoEfectivo, false)) {
            throw new AppError("Esta cita no admite encuesta.", ERROR_CODES.CONFLICT, 409);
        }

        // Persistir la fila tipada y CRUZAR en la misma tx (para que el cruce vea la fila recién escrita
        // junto con la del otro lado si ya existe).
        const resultado = await prisma.$transaction(async (tx) => {
            try {
                await tx.encuestaCita.create({
                    data: {
                        solicitudId: body.solicitudId,
                        origen,
                        seRealizo: body.seRealizo,
                        operador: body.operador,
                        inicio: body.inicio,
                        enlace: body.enlace,
                        // Coerción espejo del CHECK (el refine ya garantiza la coherencia del input).
                        razonNoRealizo: body.seRealizo ? null : body.razonNoRealizo ?? null,
                        duracion: body.seRealizo ? body.duracion ?? null : null,
                    },
                });
            } catch (e) {
                if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
                    throw new AppError(
                        "Ya respondiste la encuesta de esta cita.",
                        ERROR_CODES.CONFLICT,
                        409,
                    );
                }
                throw e;
            }
            const cruce = await cruzarEncuestasCita(body.solicitudId, tx);
            return { registrada: true, contradicciones: cruce.contradicciones.length };
        });

        return NextResponse.json({ data: resultado });
    } catch (error) {
        return errorToResponse(error, "[ENCUESTA/POST]");
    }
}
