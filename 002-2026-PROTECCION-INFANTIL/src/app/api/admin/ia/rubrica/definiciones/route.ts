import { NextResponse } from "next/server";
import { RolUsuario } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { IaRubricaService } from "@/lib/dal/services/ia-rubrica";
import { AppError, ERROR_CODES } from "@/lib/errors";

/**
 * GET /api/admin/ia/rubrica/definiciones — todas las definiciones legales por
 * categoría (SPEC-248, 002-PI-151). Lectura para ADMIN y COMITE_VALIDACION.
 */
export async function GET() {
    try {
        const user = await verifyAuth([RolUsuario.ADMIN, RolUsuario.COMITE_VALIDACION]);
        await assertModulo(user, "ia_rubrica");

        const definiciones = await new IaRubricaService().obtenerDefiniciones();
        return NextResponse.json({ definiciones });
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
