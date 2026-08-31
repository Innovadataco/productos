/**
 * SPEC-323 (T018/US4): endpoint de descarga del PDF del expediente.
 * GET /api/padre/expedientes/[id]/pdf
 * El PDF se genera en memoria y no se retiene (constitución §1.3, punto d).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";
import { generarPdfExpediente } from "@/lib/expediente/pdf-expediente";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        if (user.rol !== "PARENT") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const { id } = await params;
        const repo = new ExpedienteRepository();
        const detalle = await repo.obtenerDetalleExpediente(id, user.id);

        if (!detalle) {
            return NextResponse.json(
                { error: { message: "Expediente no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const fechaGeneracion = new Date();
        const buffer = await generarPdfExpediente({
            identificadorReportado: detalle.expediente.identificadorReportado,
            fechaApertura: detalle.expediente.fechaApertura,
            padreEmail: user.email,
            padreNombre: user.nombre ?? null,
            eventosPropios: detalle.eventosPropios,
            contextoOtros: detalle.contextoOtros,
            fechaGeneracion,
        });

        const filename = `expediente-${detalle.expediente.identificadorReportado.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

        return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Content-Length": String(buffer.length),
                "Cache-Control": "no-store",
            },
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
