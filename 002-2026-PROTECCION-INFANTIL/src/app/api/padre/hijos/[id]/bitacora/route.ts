/**
 * A-70 · F10 · GET /api/padre/hijos/[id]/bitacora — la línea de tiempo de la
 * protección del menor. Boundary: el padre dueño de la ficha (404 para otro).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { bitacoraDelMenor } from "@/lib/dal/services/bitacora-menor";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("PARENT");
        const { id } = await params;
        const bitacora = await bitacoraDelMenor(id, user.id);
        return NextResponse.json({
            hijoId: bitacora.hijoId,
            nombre: bitacora.nombre,
            monitoreadoDesde: bitacora.monitoreadoDesde?.toISOString() ?? null,
            hitos: bitacora.hitos.map((h) => ({ ...h, fecha: h.fecha.toISOString() })),
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[BITACORA-MENOR] error interno:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
