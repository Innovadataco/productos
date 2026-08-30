/**
 * SPEC-309 (A-50): GET /api/padre/home
 * Devuelve el payload agregado del dashboard proactivo del padre.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { obtenerHomePadre } from "@/lib/padre/home";

export async function GET(_request: Request) {
    try {
        const user = await verifyAuth("PARENT");
        const data = await obtenerHomePadre(user.id, user.nombre ?? null);
        return NextResponse.json({ data });
    } catch (error) {
        if (error instanceof AppError && error.code === ERROR_CODES.FORBIDDEN) {
            return errorToResponse(error, "[PADRE/HOME]");
        }
        return errorToResponse(error, "[PADRE/HOME]");
    }
}
