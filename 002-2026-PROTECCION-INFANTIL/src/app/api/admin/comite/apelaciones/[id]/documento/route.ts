import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esComiteRol } from "@/lib/operadores/permisos";
import { ComiteApelacionesService } from "@/lib/dal/services/comite-apelaciones";

/**
 * SPEC-110 — Descarga de la evidencia documental (SOLO el comité de validación).
 *
 * Enmienda constitucional: la evidencia es prueba de identidad subida por el titular
 * sobre sí mismo; la ve ÚNICAMENTE el comité de validación. ADMIN, OPERADOR, PARENT y
 * cualquier otro rol reciben 403. El endpoint descifra en memoria y streamea el PDF;
 * nunca expone una URL pública. Cada acceso registra AuditLog (APELACION_DOCUMENTO_ACCESO)
 * y una fila AccesoDocumentoApelacion (quién, cuándo, IP, user-agent).
 * Documento purgado o ausente en disco → 410.
 */

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        // Regla dura: SOLO el comité de validación descarga evidencia (ni ADMIN).
        if (!esComiteRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "La evidencia solo está disponible para el comité de validación", code: ERROR_CODES.FORBIDDEN } },
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

        const { id: rawId } = await params;
        const parsedId = idSchema.safeParse(rawId);
        if (!parsedId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const id = parsedId.data;

        // SPEC-053: guardas (404/410), descifrado en memoria, verificación de
        // integridad, bitácora de acceso y auditoría viven en el DAL; la ruta
        // solo streamea el PDF.
        const { pdf, numero } = await new ComiteApelacionesService().descargarDocumento(
            id,
            user.id,
            getClientInfo(request)
        );

        return new Response(new Uint8Array(pdf), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="evidencia-${numero}.pdf"`,
                "Content-Length": String(pdf.length),
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("[ComiteApelaciones] Error descargando evidencia:", msg);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
