/**
 * SPEC-323 (T015/US3): detalle del expediente para el padre dueño.
 * GET /api/padre/expedientes/[id]
 * Retorna eventosPropios (con texto descifrado AD-3) + contextoOtros (Ley 1581).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        if (user.rol !== "PARENT") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const { id } = await params;
        const repo = new ExpedienteRepository();
        const detalle = await repo.obtenerDetalleExpediente(id, user.id);

        if (!detalle) {
            return NextResponse.json(
                { error: { message: "Expediente no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        return NextResponse.json(detalle, { status: 200 });
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
