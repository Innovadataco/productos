import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { calcularEstadisticasColegio } from "@/lib/colegio/estadisticas";
import { generarPdfEstadisticas } from "@/lib/colegio/pdf-estadisticas";
import { logAudit } from "@/lib/audit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { AccionAudit } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function slugify(nombre: string): string {
    return nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
}

export async function GET(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Tu cuenta no está vinculada a un colegio", code: ERROR_CODES.FORBIDDEN } },
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

        const estadisticas = await calcularEstadisticasColegio(user.colegioId);
        const pdfBuffer = await generarPdfEstadisticas(estadisticas);

        const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
        const userAgent = request.headers.get("user-agent") || "unknown";

        await logAudit({
            accion: "COLEGIO_ESTADISTICAS_PDF_DESCARGADO" as AccionAudit,
            tipoRecurso: "Colegio",
            recursoId: user.colegioId,
            usuarioId: user.id,
            valorNuevo: JSON.stringify({ colegioId: user.colegioId, timestamp: new Date().toISOString() }),
            ipAddress,
            userAgent,
        });

        const fecha = new Date().toISOString().slice(0, 10);
        const nombreArchivo = `estadisticas-${slugify(estadisticas.colegioNombre)}-${fecha}.pdf`;

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
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
