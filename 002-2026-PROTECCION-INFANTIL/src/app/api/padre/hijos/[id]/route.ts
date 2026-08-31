import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { cambiarEstadoHijo } from "@/lib/dal/services/hijos";

// SPEC-325 (extensión) · activar/inactivar un hijo. El DAL exige que el padre sea
// dueño del hijo (PII acceso-solo-dueño); nunca por id suelto sin verificar.
const patchSchema = z.object({ estado: z.enum(["activo", "inactivo"]) });

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
        const res = await cambiarEstadoHijo(usuario.id, id, parsed.data.estado);
        return NextResponse.json(res);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        if (error instanceof Error && /no encontrado/i.test(error.message)) {
            return NextResponse.json(
                { error: { message: "Hijo no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        logger.error("[HIJOS] Error cambiando estado del hijo:", error);
        return NextResponse.json(
            { error: { message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
