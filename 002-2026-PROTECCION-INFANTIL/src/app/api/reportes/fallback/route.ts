import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEnv } from "@/lib/env";
import { ERROR_CODES } from "@/lib/errors";
import { registrarTransicion } from "@/lib/reporte-transiciones";
import { asignarOperadorAReporte } from "@/lib/operadores/asignador";

export async function POST(request: Request) {
    try {
        const secret = request.headers.get("x-worker-secret");
        if (secret !== requireEnv("WORKER_SECRET", 8)) {
            return NextResponse.json(
                { error: { message: "Unauthorized", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const body = (await request.json()) as { reporteId?: string; error?: string; errorCode?: string };
        const reporteId = body.reporteId;
        const errorCode = body.errorCode ?? ERROR_CODES.INTERNAL_ERROR;

        if (!reporteId) {
            return NextResponse.json(
                { error: { message: "reporteId requerido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

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
            console.error("[FALLBACK] Error asignando operador:", err)
        );

        return NextResponse.json({ reporteId, estado: "REVISION_MANUAL" });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[FALLBACK] Error:", msg);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
