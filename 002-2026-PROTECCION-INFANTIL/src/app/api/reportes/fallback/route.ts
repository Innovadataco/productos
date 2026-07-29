import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ERROR_CODES } from "@/lib/errors";
import { verificarWorkerSecret } from "@/lib/worker-auth";
import { fallbackReporteSchema } from "@/lib/validators";
import { logger } from "@/lib/logger";
import { registrarTransicion } from "@/lib/reporte-transiciones";
import { asignarOperadorAReporte } from "@/lib/operadores/asignador";

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

        const reporte = await prisma.reporte.findUnique({
            where: { id: reporteId },
            select: { id: true, estado: true, numeroSeguimiento: true, identificador: true },
        });

        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (reporte.estado === "REVISION_MANUAL") {
            return NextResponse.json({ reporteId, estado: "REVISION_MANUAL", message: "Ya estaba en revisión manual" });
        }

        const mensajeGenerico = "Reintentos agotados procesando el reporte";

        await prisma.$transaction(async (tx) => {
            await registrarTransicion({
                reporteId,
                estadoAnterior: reporte.estado,
                estadoNuevo: "REVISION_MANUAL",
                responsableTipo: "WORKER",
                motivo: mensajeGenerico,
                metadatos: { errorCode },
                tx,
            });
            await tx.reporte.update({
                where: { id: reporteId },
                data: {
                    estado: "REVISION_MANUAL",
                    processingError: `${mensajeGenerico} (código: ${errorCode})`,
                },
            });
        });

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
