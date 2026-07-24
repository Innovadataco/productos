import { NextResponse } from "next/server";
import { RolUsuario } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { cargarConfigRubrica } from "@/lib/ai/rubrica";
import { AppError, ERROR_CODES } from "@/lib/errors";

/**
 * GET /api/admin/ia/rubrica — configuración actual de la rúbrica (spec 090, US3-bis).
 * Lee los parámetros ia.rubrica.* (con defaults de la semilla si no existen).
 */
export async function GET() {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_rubrica");

        const cfg = await cargarConfigRubrica();
        return NextResponse.json({
            preguntas: cfg.preguntas,
            modelos: cfg.modelos,
            temperatura: cfg.temperatura,
            umbralPresencia: cfg.umbralPresencia,
            modeloEmbudo: cfg.modeloEmbudo,
        });
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
