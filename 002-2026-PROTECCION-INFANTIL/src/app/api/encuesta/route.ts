/**
 * SPEC-784 · La encuesta de servicio de la cita, sobre el modelo TIPADO de 753.
 *   GET  → las citas del usuario con encuesta pendiente PARA ÉL (fuente única).
 *   POST → registra la fila `EncuestaCita` con los ENUMS de 753 y CRUZA con el otro lado (753 service).
 *
 * La ruta valida entrada + autentica y DELEGA en el DAL (`encuesta-cita`): no toca Prisma. Cambios
 * sobre #341 (que guardaba `r1..r5` de texto libre):
 *  - El `origen` (PADRE/PROFESIONAL) NO viene del cuerpo: lo deriva el DAL del rol autenticado y
 *    verifica la PARTICIPACIÓN. #341 lo tomaba del body — un padre podía enviarse como PROFESIONAL.
 *  - Coherencia del CHECK VALIDADO como defensa en profundidad (razón sii NO se realizó; duración sii
 *    SÍ; la UI ya lo hace imposible por estructura — FR-3).
 *  - 2º envío del mismo lado → 409 (`@@unique([solicitudId, origen])`).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { OperadorConvoco, InicioSesion, EnlaceFunciono, DuracionSesion, RazonNoSesion } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { citasPendientesEncuesta, registrarEncuestaCita } from "@/lib/dal/services/encuesta-cita";

export async function GET() {
    try {
        const user = await verifyAuth();
        const pendientes = await citasPendientesEncuesta(user.id, user.rol, new Date());
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
        const body = bodySchema.parse(await request.json());
        const resultado = await registrarEncuestaCita({
            solicitudId: body.solicitudId,
            usuarioId: user.id,
            rol: user.rol,
            seRealizo: body.seRealizo,
            operador: body.operador,
            inicio: body.inicio,
            enlace: body.enlace,
            ...(body.razonNoRealizo !== undefined ? { razonNoRealizo: body.razonNoRealizo } : {}),
            ...(body.duracion !== undefined ? { duracion: body.duracion } : {}),
        });
        return NextResponse.json({ data: resultado });
    } catch (error) {
        return errorToResponse(error, "[ENCUESTA/POST]");
    }
}
