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
import { registrarInformePadre } from "@/lib/dal/services/informes-padre";
import { randomBytes, createHash } from "node:crypto";

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
        // SPEC-340 (§4.3): el orden del sello (contrato de SPEC-234, replicado):
        // 1) el CÓDIGO se decide ANTES y va impreso en el pie;
        // 2) se renderiza; 3) el HASH es del buffer FINAL (jamás entra al PDF —
        // un hash impreso invalidaría su propia verificación); 4) se registra.
        const codigoVerificacion = randomBytes(8).toString("hex"); // 16 hex

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pi.innovadataco.com";
        const buffer = await generarPdfExpediente({
            identificadorReportado: detalle.expediente.identificadorReportado,
            fechaApertura: detalle.expediente.fechaApertura,
            padreEmail: user.email,
            padreNombre: user.nombre ?? null,
            eventosPropios: detalle.eventosPropios,
            contextoOtros: detalle.contextoOtros,
            fechaGeneracion,
            codigoVerificacion,
            urlVerificacion: `${baseUrl}/verificar/${codigoVerificacion}`,
        });

        const pdfHash = createHash("sha256").update(buffer).digest("hex");

        // Cada generación queda auditada PERMANENTE (§4.3: "si en dos años el
        // padre vuelve, ve el día exacto en que sacó cada informe").
        await registrarInformePadre({
            expedienteId: id,
            generadoPorId: user.id,
            pdfHash,
            codigoVerificacion,
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
