import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { desvincularIdentificador } from "@/lib/dal/services/hijos";

// SPEC-325 · "quitar" un identificador del hijo = desvincularlo de la vista de
// ESTE padre (no borra · es compartido con el otro padre · §3.1-bis). El DAL
// exige que el padre sea dueño del hijo (PII acceso-solo-dueño).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const usuario = await verifyAuth("PARENT");
        const { id } = await params;
        await desvincularIdentificador(usuario.id, id);
        return NextResponse.json({ ok: true });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        if (error instanceof Error && /no encontrado/i.test(error.message)) {
            return NextResponse.json(
                { error: { message: "Identificador no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        logger.error("[HIJOS] Error desvinculando identificador:", error);
        return NextResponse.json(
            { error: { message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
