import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { idSchema } from "@/lib/validators";
import { cargarDatosExpediente } from "@/lib/expediente/expediente";
import { armarExpedienteForense } from "@/lib/expediente/expediente-forense";
import { IdentificadorReportadoRepository } from "@/lib/dal/repositories/identificador-reportado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/admin/reportes/[id]/forense (SPEC-140, N-4, FR-006).
 * Vista forense del expediente con la lista CERRADA de campos autorizados
 * (whitelist): NUNCA identidad del denunciante, IP, huella anti-abuso, texto
 * del reporte ni tenant. La VISTA no audita (lectura ya cubierta por el gate
 * del módulo); la EXPORTACIÓN a PDF sí (ver ./pdf).
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

        return NextResponse.json(forense);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[ExpedienteForense] Error armando vista forense", {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
