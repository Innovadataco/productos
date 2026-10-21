import { NextResponse } from "next/server";
import { z } from "zod";
import { ERROR_CODES } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyToken } from "@/lib/auth";
import { consultaBodySchema } from "@/lib/validators";
import { ConsultaPublicaService } from "@/lib/dal/services/consulta-publica";

const consultaSchema = z.object({
    identificador: z.string().min(3).max(100),
});

/**
 * GET /api/consulta?identificador=...
 * Consulta pública de un identificador reportado (número, nick o usuario).
 *
 * Informa con hechos agregados, NUNCA juzga a la persona (sin nivelRiesgo ni score —
 * spec 089-US6). Solo cuenta reportes aprobados (spec 089-US3: estado CLASIFICADO/
 * CORREGIDO, categoría ∉ {SPAM,OTRO}, no eliminado).
 * Divulgación progresiva: anónimo = resumen; autenticado = ciudad, timeline,
 * plataformas completas e informe.
 */
async function resolverConsulta(request: Request, identificador: string) {
    try {
        const rate = await checkRateLimit(request, "consulta");
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

        // Divulgación progresiva (US7): sesión opcional, nunca bloquea al anónimo.
        // El token se lee del header cookie de la Request (sin next/headers: funciona
        // también fuera de request scope, p. ej. en tests de integración).
        const cookieHeader = request.headers.get("cookie") ?? "";
        const tokenMatch = cookieHeader.match(/(?:^|;\s*)(?:__Host-token|token)=([^;]+)/);
        const payload = tokenMatch ? await verifyToken(tokenMatch[1]) : null;
        const autenticado = !!payload;

        // SPEC-053: la agregación y las reglas de visibilidad viven en el DAL;
        // la ruta no toca prisma. F3: el contexto alimenta el evento analítico
        // de consulta vacía (IP hasheada por logAudit, nunca el identificador).
        const respuesta = await new ConsultaPublicaService().resumen(parsed.data.identificador, autenticado, {
            ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
            userAgent: request.headers.get("user-agent") || undefined,
        });

        return NextResponse.json(respuesta);
    } catch {
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

// SPEC-897 (seguridad · regla dura 091-US1): NO hay handler GET. El identificador (teléfono/nick del
// presunto agresor, y la señal de a quién investiga un padre) NUNCA debe viajar en la URL — quedaría en
// el historial, en los logs de proxy/CDN y en la cabecera Referer. Solo POST con el identificador en el
// cuerpo; un GET recibe 405 de Next (método no exportado). El cliente web ya usa POST.

/**
 * POST /api/consulta — consulta pública con el identificador en el CUERPO.
 * Regla dura de privacidad: el identificador nunca queda en historial, logs ni caché de URLs.
 */
export async function POST(request: Request) {
    // SPEC-125: esquema tolerante — por privacidad el body NUNCA produce 400
    // (un body inválido equivale a identificador vacío, igual que antes).
    const body = consultaBodySchema.parse(await request.json().catch(() => undefined));
    return resolverConsulta(request, body.identificador ?? "");
}
