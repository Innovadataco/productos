/**
 * SPEC-291 (002-PI-191) — GET /api/admin/servicios/estado
 * Devuelve estado + salud de los 12 contenedores conocidos. Solo `sistema_admin`.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { inspeccionarEstado } from "@/lib/servicios/docker-adapter";

export async function GET() {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "sistema_admin");
        const servicios = await inspeccionarEstado();
        return NextResponse.json({ servicios });
    } catch (error) {
        if (error instanceof AppError) return NextResponse.json(error.toJSON(), { status: error.statusCode });
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 },
        );
    }
}
