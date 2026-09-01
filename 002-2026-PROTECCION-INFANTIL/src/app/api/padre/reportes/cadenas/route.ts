/**
 * SPEC-340 (A-68 §3.1) — GET /api/padre/reportes/cadenas.
 * Una entrada por cadena para las tarjetas de Mis reportes. El texto NUNCA
 * viaja acá (solo por la ruta de detalle con step-up).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { listarCadenasPadre } from "@/lib/dal/services/cadenas-padre";
import { getParametroSistemaValor } from "@/lib/parametros";

export async function GET() {
    try {
        const usuario = await verifyAuth("PARENT");
        const [cadenas, retapadoValor] = await Promise.all([
            listarCadenasPadre(usuario.id),
            getParametroSistemaValor("padre.texto.retapado_minutos"),
        ]);
        // SPEC-340 §3.3-bis: el minutero del re-tapado del texto sensible
        // viaja con el listado para que TextoSensible use el parámetro real.
        const retapadoMinutos = Number.parseInt(retapadoValor ?? "10", 10) || 10;
        return NextResponse.json({ cadenas, retapadoMinutos });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[CADENAS] Error listando cadenas del padre:", error);
        return NextResponse.json(
            { error: { message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
