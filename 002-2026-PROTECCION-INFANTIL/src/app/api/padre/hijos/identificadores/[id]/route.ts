import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { desvincularIdentificador, cambiarEstadoIdentificador } from "@/lib/dal/services/hijos";

const patchSchema = z.object({ activo: z.boolean() });

// SPEC-325 (extensión) · activar/inactivar un identificador del hijo (flag global
// compartido). El DAL exige que el padre sea dueño (PII acceso-solo-dueño).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const usuario = await verifyAuth("PARENT");
        const { id } = await params;
        const parsed = patchSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const res = await cambiarEstadoIdentificador(usuario.id, id, parsed.data.activo);
        return NextResponse.json(res);
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
        logger.error("[HIJOS] Error cambiando estado de identificador:", error);
        return NextResponse.json(
            { error: { message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

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
