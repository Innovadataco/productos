import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { idSchema } from "@/lib/validators";
import { solicitarCodigoAcceso } from "@/lib/dal/services/codigo-acceso";

/**
 * POST /api/padre/expedientes/[id]/solicitar-acceso — SPEC-610 (I-372 · D-123/D-129).
 *
 * El PADRE dueño del EXPEDIENTE genera «el pase para su psicólogo»: 8 caracteres
 * sin ambigüedades, vigente 30 min para canjear, un solo pase activo por
 * expediente. El pase abre el EXPEDIENTE COMPLETO (todos sus eventos), no un
 * reporte suelto — ese era I-372: el mecanismo existía pero abría de menos y no
 * se alcanzaba. Vive bajo `/api/padre/**` (territorio del padre; el profesional
 * NO genera pases, solo los canjea), junto al resto de rutas del expediente.
 *
 * El pase viaja por correo (canal oficial) y se devuelve acá para mostrarlo UNA
 * sola vez en pantalla. Response: { codigo, vigenteHasta }.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("PARENT");

        const rate = await checkRateLimit(request, "acceso_codigo", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id: rawId } = await params;
        const parsedId = idSchema.safeParse(rawId);
        if (!parsedId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const resultado = await solicitarCodigoAcceso({
            expedienteId: parsedId.data,
            solicitadoPorId: user.id,
            ip: getClientIp(request),
        });

        return NextResponse.json(resultado, { status: 201 });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
