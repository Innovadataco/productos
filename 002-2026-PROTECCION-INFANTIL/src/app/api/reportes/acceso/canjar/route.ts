import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { canjearCodigoAcceso } from "@/lib/dal/services/codigo-acceso";

/**
 * POST /api/reportes/acceso/canjar — SPEC-584 (Fase 3).
 *
 * Profesional (o el mismo padre) autenticado canjea el código que le pasaron:
 * valida hash + vigencia (30 min) + un solo canje, abre la sesión de
 * visualización de 15 min y devuelve el token opaco de sesión. La auditoría
 * queda con AMBOS responsables (solicitante en la fila del código, canjeador
 * acá) y el padre solicitante recibe correo avisando quién canjeó.
 *
 * Body: { codigo: string }. Response: { tokenSesion, expiraEn, reporteId }.
 */
const canjarSchema = z.object({
    codigo: z.string().min(4).max(20),
});

export async function POST(request: Request) {
    try {
        const user = await verifyAuth(["PARENT", "PROFESIONAL"]);

        const rate = await checkRateLimit(request, "acceso_canje", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await request.json().catch(() => null);
        const parsed = canjarSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Código inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const resultado = await canjearCodigoAcceso({
            codigoCrudo: parsed.data.codigo,
            canjeadoPor: { id: user.id, nombre: user.nombre, rol: user.rol },
            ip: getClientIp(request),
        });

        return NextResponse.json(resultado);
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
