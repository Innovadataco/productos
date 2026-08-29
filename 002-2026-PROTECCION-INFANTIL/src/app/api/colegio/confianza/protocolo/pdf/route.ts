import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { leerDocumentoConfianza } from "@/lib/colegio/confianza-documentos";
import { renderProtocoloPDF } from "@/lib/colegio/render-protocolo-pdf";
import { calcularEstadisticasColegio } from "@/lib/colegio/estadisticas";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const runtime = "nodejs";

function slugify(nombre: string): string {
    return nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

export async function GET(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_gestion");

        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const documento = await leerDocumentoConfianza("protocolo");
        if (!documento) {
            return NextResponse.json(
                { error: { message: "Protocolo no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const estadisticas = await calcularEstadisticasColegio(user.colegioId);
        const buffer = await renderProtocoloPDF(estadisticas.colegioNombre, documento.titulo, documento.markdown);

        await logAudit({
            accion: "COLEGIO_INFORME_MENSUAL_PDF_DESCARGADO",
            tipoRecurso: "ProtocoloConfianza",
            usuarioId: user.id,
            colegioId: user.colegioId,
            valorNuevo: JSON.stringify({ documento: documento.clave, bytes: buffer.byteLength }),
            ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
            userAgent: request.headers.get("user-agent") || "unknown",
        });

        const filename = `protocolo-${slugify(estadisticas.colegioNombre)}.pdf`;
        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
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
