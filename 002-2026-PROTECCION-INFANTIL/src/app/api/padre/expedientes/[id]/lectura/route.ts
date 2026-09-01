/**
 * SPEC-340 (A-68 §4.4 · capa 1) — GET /api/padre/expedientes/[id]/lectura.
 *
 * «Lo que muestra tu expediente»: SOLO cifras calculadas en vivo de los datos
 * (siempre al día, con o sin análisis). Toda la consulta vive en el DAL (Q-3).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { lecturaDelExpediente } from "@/lib/dal/services/expediente-vivo";
import { getParametroSistemaValor } from "@/lib/parametros";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const usuario = await verifyAuth("PARENT");
        const { id } = await params;

        const [resultado, retapadoValor] = await Promise.all([
            lecturaDelExpediente(id, usuario.id),
            getParametroSistemaValor("padre.texto.retapado_minutos"),
        ]);
        if (!resultado) {
            return NextResponse.json(
                { error: { message: "Expediente no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        // SPEC-340 §3.3-bis: el minutero del re-tapado viaja con la lectura
        // para que ExpedienteVivo pueda pasárselo a TextoSensible.
        const retapadoMinutos = Number.parseInt(retapadoValor ?? "10", 10) || 10;
        return NextResponse.json({ ...resultado, retapadoMinutos });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[LECTURA] Error calculando la capa 1:", error);
        return NextResponse.json(
            { error: { message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
