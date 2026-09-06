import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { idSchema } from "@/lib/validators";
import { descifrarCampoReporte } from "@/lib/dal/services/descifrar-contenido";
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
        const reporte = await new ReporteRepository().findContenidoId(reporteId);
        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        // S-C: el textoOriginal (evidencia inmutable) vive cifrado en ContenidoReporte; se
        // descifra por su contenidoId. Fail-loud: si la DEK murió (cripto-shred) LANZA — no
        // muestra vacío ni el sobre crudo.
        const textoOriginal = await descifrarCampoReporte(reporte.contenidoId, "textoOriginal");

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "TEXTO_ORIGINAL_REVELADO",
            tipoRecurso: "Reporte",
            recursoId: reporteId,
            usuarioId: user.id,
            ipAddress,
            userAgent,
            // No se almacena el texto original ni la clave. S-C: el original SIEMPRE está
            // cifrado (DEK por denuncia en ContenidoReporte), no hay rama en claro.
            metadatos: { cifrado: true },
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
