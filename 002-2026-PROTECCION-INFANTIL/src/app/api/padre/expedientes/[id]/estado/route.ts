/**
 * SPEC-605 · GET /api/padre/expedientes/[id]/estado — «Consultar estado».
 *
 * Refetch ligero del estado FRESCO del expediente para el botón de la cabecera
 * de la pantalla madre: eventos propios aún en cola del motor → EN_PROCESO;
 * todos clasificados → PROCESADO. Sin línea de tiempo ni análisis (eso lo da
 * la página); sin texto jamás (la ruta vieja GET [id] sigue borrada, candado
 * SPEC-340 — este endpoint expone solo estados y fechas).
 *
 * Boundary: PARENT dueña del expediente — 403 otros roles, 404 ajenos.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { estadoFrescoExpediente } from "@/lib/dal/services/expediente-detalle";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        if (user.rol !== "PARENT") {
            throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
        }

        const { id } = await params;
        const estado = await estadoFrescoExpediente(id, user.id);
        if (!estado) {
            throw new AppError("Expediente no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        return NextResponse.json(
            {
                estadoExpediente: estado.estadoExpediente,
                estadoLabel: estado.estadoLabel,
                estadoReportes: estado.estadoReportes,
                procesando: estado.procesando,
                ultimoEventoEn: estado.ultimoEventoEn?.toISOString() ?? null,
                actualizadoEn: estado.actualizadoEn.toISOString(),
            },
            { status: 200 }
        );
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[EXPEDIENTE·ESTADO] error interno:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
