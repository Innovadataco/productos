import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { AlertaService } from "@/lib/dal/services/alertas";

/**
 * GET /api/alertas
 * Lista las suscripciones de alertas del usuario autenticado.
 */
export async function GET() {
    try {
        const user = await verifyAuth();
        // SPEC-053: la consulta vive en el DAL; la ruta no toca prisma.
        const suscripciones = await new AlertaService().listar(user.id);
        return NextResponse.json({ suscripciones });
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
