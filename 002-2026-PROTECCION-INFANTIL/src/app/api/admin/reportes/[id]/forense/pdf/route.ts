import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { idSchema } from "@/lib/validators";
import { cargarDatosExpediente } from "@/lib/expediente/expediente";
import { armarExpedienteForense, generarPdfForense } from "@/lib/expediente/expediente-forense";
import { IdentificadorReportadoRepository } from "@/lib/dal/repositories/identificador-reportado";
import { logAuditNuevaAccion, ACCION_EXPEDIENTE_FORENSE_EXPORTADO } from "@/lib/audit-nuevas-acciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

/**
 * GET /api/admin/reportes/[id]/forense/pdf (SPEC-140, N-4, FR-006).
 * Exportación del expediente forense a PDF: se genera en memoria y se descarga
 * por attachment (la plataforma NO lo retiene) y registra
 * EXPEDIENTE_FORENSE_EXPORTADO en AuditLog SIN contenido — la exportación saca
 * el documento del perímetro, por eso audita y la vista JSON no.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "denuncia_formal");

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id: rawId } = await params;
        const parsedId = idSchema.safeParse(rawId);
        if (!parsedId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const reporteId = parsedId.data;

        const datos = await cargarDatosExpediente(reporteId);
        if (!datos || datos.reporte.eliminado) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const agregado = await new IdentificadorReportadoRepository().findByPar(
            datos.reporte.identificador,
            datos.reporte.plataformaId
        );
        const forense = armarExpedienteForense(datos.reporte, agregado?.totalReportes ?? null);
        const pdfBuffer = await generarPdfForense(forense, new Date());

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAuditNuevaAccion({
            accion: ACCION_EXPEDIENTE_FORENSE_EXPORTADO,
            tipoRecurso: "Reporte",
            recursoId: reporteId,
            usuarioId: user.id,
            ipAddress,
            userAgent,
            metadatos: { reporteId, usuarioId: user.id, fecha: new Date().toISOString() },
        });

        const nombreArchivo = `expediente-forense-${datos.reporte.numeroSeguimiento ?? reporteId}.pdf`;
        return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
            },
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[ExpedienteForense] Error exportando PDF forense", {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
