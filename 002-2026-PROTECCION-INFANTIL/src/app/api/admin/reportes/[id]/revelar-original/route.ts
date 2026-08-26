import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { idSchema } from "@/lib/validators";
import { decryptParameter, isEncryptedValue } from "@/lib/param-encryption";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        // Spec 096-US5 + SPEC-266: módulo específico; bandeja_reportes era redundante.
        await assertModulo(user, "expediente_revelar_original");

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

        // E-8: la lectura (solo textoOriginal cifrado) vive en el repo; el
        // descifrado sigue por el helper autorizado de SPEC-130.
        const reporte = await new ReporteRepository().findTextoOriginalCifrado(reporteId);
        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (!reporte.textoOriginal) {
            return NextResponse.json(
                { error: { message: "No hay texto original para este reporte", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        let textoOriginal: string;
        if (isEncryptedValue(reporte.textoOriginal)) {
            textoOriginal = decryptParameter(reporte.textoOriginal);
        } else {
            // Compatibilidad con registros previos a la encriptación.
            textoOriginal = reporte.textoOriginal;
        }

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "TEXTO_ORIGINAL_REVELADO",
            tipoRecurso: "Reporte",
            recursoId: reporteId,
            usuarioId: user.id,
            ipAddress,
            userAgent,
            // No se almacena el texto original ni la contraseña de cifrado.
            metadatos: { cifrado: isEncryptedValue(reporte.textoOriginal) },
        });

        return NextResponse.json({ textoOriginal });
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
