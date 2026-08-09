/**
 * SPEC-151 (FR-001): informe PDF mensual determinístico del colegio.
 * GET /api/colegio/reportes/pdf?mes=YYYY-MM
 *
 * - Genera el PDF con `@react-pdf/renderer` en runtime Node (sin headless).
 * - Tenant-first: usa el colegio del SCHOOL_ADMIN autenticado.
 * - Registra auditoría de descarga con metadatos (mes, bytes).
 * - No expone PII: solo agregados.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { renderInformeMensualPDF } from "@/lib/colegio/render-informe-mensual";
import { informeMensualQuerySchema } from "@/lib/schemas";

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

        const { searchParams } = new URL(request.url);
        const query = informeMensualQuerySchema.parse({ mes: searchParams.get("mes") ?? "" });

        const { datos, buffer } = await renderInformeMensualPDF(user.colegioId, query.mes);

        await logAudit({
            accion: "COLEGIO_INFORME_MENSUAL_PDF_DESCARGADO",
            tipoRecurso: "InformeMensualColegio",
            usuarioId: user.id,
            colegioId: user.colegioId,
            valorNuevo: JSON.stringify({ mes: query.mes, bytes: buffer.byteLength }),
            ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
            userAgent: request.headers.get("user-agent") || "unknown",
        });

        const filename = `informe-mensual-${slugify(datos.colegioNombre)}-${query.mes}.pdf`;
        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/REPORTES/PDF]");
    }
}
