/**
 * SPEC-305 (A-50): GET /api/padre/circulo-confianza/semaforo
 * Devuelve el semáforo de riesgo por cada contacto del círculo de confianza
 * del padre autenticado.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { listarSemaforosPorPadre } from "@/lib/padre/semaforo";

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
        const items = await listarSemaforosPorPadre(user.id);
        return NextResponse.json({ items });
    } catch (error) {
        return errorToResponse(error, "[PADRE/CIRCULO-CONFIANZA/SEMAFORO]");
    }
}
