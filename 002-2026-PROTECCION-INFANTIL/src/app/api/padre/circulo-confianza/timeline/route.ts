/**
 * SPEC-306 (A-50): GET /api/padre/circulo-confianza/timeline
 * Devuelve la línea de tiempo de eventos de los últimos 30 días asociados a
 * los identificadores del círculo de confianza del padre autenticado.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { construirTimelineCirculo } from "@/lib/padre/timeline-circulo";

async function requirePadre() {
    const user = await verifyAuth();
    if (user.rol !== "PARENT") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
    return user;
}

export async function GET(_request: Request) {
    try {
        const user = await requirePadre();
        const items = await construirTimelineCirculo(user.id);
        return NextResponse.json({ items });
    } catch (error) {
        return errorToResponse(error, "[PADRE/CIRCULO-CONFIANZA/TIMELINE]");
    }
}
