import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { consultaBodySchema } from "@/lib/validators";
import { ConsultaPublicaService } from "@/lib/dal/services/consulta-publica";

const consultaSchema = z.object({
    identificador: z.string().min(3).max(100),
});

async function resolverDetalle(request: Request, identificador: string) {
    try {
        try {
            await verifyAuth("PARENT");
        } catch {
            return NextResponse.json(
                { error: { message: "No autenticado", code: ERROR_CODES.AUTH_INVALID } },
                { status: 401 }
            );
        }

        const rate = await checkRateLimit(request, "consulta_detalle");
        if (!rate.allowed) {
            return NextResponse.json(
                {
                    error: {
                        message: "Demasiadas consultas. Intenta más tarde.",
                        code: ERROR_CODES.RATE_LIMITED,
                        retryAfter: Math.ceil((rate.resetAt - Date.now()) / 1000),
                    },
                },
                { status: 429, headers: rate.headers }
            );
        }

        const parsed = consultaSchema.safeParse({ identificador });
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Identificador inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // SPEC-053: la agregación, la visibilidad y el mapeo a DTOs viven en el DAL;
        // la ruta no toca prisma. F3: el contexto alimenta el evento analítico
        // de consulta vacía (IP hasheada por logAudit, nunca el identificador).
        const respuesta = await new ConsultaPublicaService().detalle(parsed.data.identificador, {
            ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
            userAgent: request.headers.get("user-agent") || undefined,
        });

        return NextResponse.json(respuesta);
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

// SPEC-897 (seguridad · regla dura 091-D): NO hay handler GET — el identificador nunca va en la URL
// (historial, logs de proxy/CDN, Referer). Solo POST con el identificador en el cuerpo; un GET recibe
// 405 de Next (método no exportado). El cliente web ya usa POST.

/** POST /api/consulta/detalle — detalle autenticado con el identificador en el CUERPO. */
export async function POST(request: Request) {
    // SPEC-125: esquema tolerante — por privacidad el body NUNCA produce 400.
    const body = consultaBodySchema.parse(await request.json().catch(() => undefined));
    return resolverDetalle(request, body.identificador ?? "");
}
