import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

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

        const suscripcion = await prisma.alertaSuscripcion.findUnique({
            where: { id },
        });

        if (!suscripcion) {
            return NextResponse.json(
                { error: { message: "Suscripción no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (suscripcion.usuarioId !== user.id && user.rol !== "ADMIN") {
            return NextResponse.json(
                { error: { message: "No autorizado", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        await prisma.alertaSuscripcion.update({
            where: { id },
            data: { activa: false },
        });

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
