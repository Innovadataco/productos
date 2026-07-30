import { NextResponse } from "next/server";
import { ERROR_CODES } from "@/lib/errors";
import { verificarWorkerSecret } from "@/lib/worker-auth";
import { fallbackReporteSchema } from "@/lib/validators";
import { logger } from "@/lib/logger";
import { asignarOperadorAReporte } from "@/lib/operadores/asignador";
import { registrarFallbackWorker } from "@/lib/dal/services/reporte-processing/fallback-worker";

export async function POST(request: Request) {
    try {
        // SPEC-125: una sola verificación del secreto del worker (src/lib/worker-auth.ts).
        const secretResult = verificarWorkerSecret(request);
        if (!secretResult.ok) return secretResult.response;

        // SPEC-125: esquema Zod; JSON malformado → 400 (antes caía al catch → 500).
        const bodyRaw = await request.json().catch(() => undefined);
        const parsed = fallbackReporteSchema.safeParse(bodyRaw);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: bodyRaw === undefined ? "Body inválido" : "reporteId requerido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const reporteId = parsed.data.reporteId;
        const errorCode = parsed.data.errorCode ?? ERROR_CODES.INTERNAL_ERROR;

        // SPEC-053: la transición a REVISION_MANUAL vive en el DAL; la ruta no toca prisma.
        const resultado = await registrarFallbackWorker(reporteId, errorCode);

        if (!resultado.ok) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (resultado.yaEnRevision) {
            return NextResponse.json({ reporteId, estado: "REVISION_MANUAL", message: "Ya estaba en revisión manual" });
        }

        asignarOperadorAReporte(reporteId).catch((err) =>
            logger.error("[FALLBACK] Asignación de operador: fallida", err)
        );

        return NextResponse.json({ reporteId, estado: "REVISION_MANUAL" });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[FALLBACK] Procesamiento de fallback: fallido — ${msg}`);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
