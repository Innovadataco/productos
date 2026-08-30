/**
 * SPEC-307 (A-50): GET /api/padre/home/sugerencia
 * Devuelve la sugerencia proactiva contextual para el padre autenticado.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { construirSugerenciaProactiva } from "@/lib/padre/sugerencia-proactiva";

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
        const sugerencia = await construirSugerenciaProactiva(user.id);
        return NextResponse.json(sugerencia);
    } catch (error) {
        return errorToResponse(error, "[PADRE/HOME/SUGERENCIA]");
    }
}
