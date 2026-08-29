import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { AlertaService } from "@/lib/dal/services/alertas";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * DELETE /api/alertas/:id
 * Cancela (desactiva) una suscripción. El dueño o un admin pueden hacerlo.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
    try {
        const user = await verifyAuth();
        const { id } = await params;

        // SPEC-053: búsqueda, autorización por dueño y desactivación viven en el DAL;
        // la ruta no toca prisma.
        const resultado = await new AlertaService().cancelar(id, user.id, user.rol);

        if (!resultado.ok) {
            if (resultado.tipo === "no_encontrada") {
                return NextResponse.json(
                    { error: { message: "Suscripción no encontrada", code: ERROR_CODES.NOT_FOUND } },
                    { status: 404 }
                );
            }
            return NextResponse.json(
                { error: { message: "No autorizado", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        return NextResponse.json({ ok: true });
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
