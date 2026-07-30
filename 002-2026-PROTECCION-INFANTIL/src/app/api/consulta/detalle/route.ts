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
        // la ruta no toca prisma.
        const respuesta = await new ConsultaPublicaService().detalle(parsed.data.identificador);

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

/** GET (compat API). El cliente web usa POST: el identificador nunca va en la URL (spec 091-D). */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    return resolverDetalle(request, searchParams.get("identificador") ?? "");
}

/** POST /api/consulta/detalle — detalle autenticado con el identificador en el CUERPO. */
export async function POST(request: Request) {
    // SPEC-125: esquema tolerante — por privacidad el body NUNCA produce 400.
    const body = consultaBodySchema.parse(await request.json().catch(() => undefined));
    return resolverDetalle(request, body.identificador ?? "");
}
