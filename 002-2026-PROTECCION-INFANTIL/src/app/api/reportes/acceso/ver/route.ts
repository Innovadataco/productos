import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { hashCodigoAcceso } from "@/lib/acceso-codigo";
import { leerTextoConSesion } from "@/lib/dal/services/codigo-acceso";

/**
 * GET /api/reportes/acceso/ver?token=... — SPEC-584 (Fase 3).
 *
 * Lectura del texto del reporte con la sesión abierta al canjear el código.
 * CADA llamada revalida la expiración de la sesión (15 min desde el canje);
 * expirada → 410 con mensaje claro. Devuelve SOLO el texto de trabajo (la
 * evidencia `textoOriginal` es interna y jamás sale por esta vía) y la lectura
 * queda auditada como actor EXTERNO vinculado al código canjeado.
 *
 * Response: { texto, expiraEn }.
 */
const verQuerySchema = z.object({
    token: z.string().uuid("Token de sesión inválido"),
});

export async function GET(request: Request) {
    try {
        // La sesión la porta el token; la cookie además exige un usuario autenticado
        // (PARENT o PROFESIONAL) — la capa proxy ya cortó a los demás roles.
        await verifyAuth(["PARENT", "PROFESIONAL"]);

        const url = new URL(request.url);
        const parsed = verQuerySchema.safeParse({ token: url.searchParams.get("token") });
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Token de sesión inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // El identificador del rate limit es el HASH del token: el token en claro
        // (credencial) jamás se persiste, ni siquiera en la tabla de ventanas.
        const rate = await checkRateLimit(request, "acceso_lectura", {
            identifier: hashCodigoAcceso(parsed.data.token),
        });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const userAgent = request.headers.get("user-agent");
        const resultado = await leerTextoConSesion({
            tokenSesion: parsed.data.token,
            ip: getClientIp(request),
            ...(userAgent ? { userAgent } : {}),
        });

        return NextResponse.json(resultado);
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
