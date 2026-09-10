/**
 * SPEC-606 (2026-09-09) — POST /api/padre/step-up/verificar.
 *
 * Paso 2 del step-up del texto sensible: canjea el código de 6 dígitos que el
 * padre recibió en su correo. Si firma bien (hash coincide, vigente, sin
 * consumir, con intentos disponibles), se emite el MISMO sello step-up de
 * siempre: la autoridad posterior (`GET /api/padre/reportes/[id]/texto`) no
 * distingue cómo se revalidó, solo que se revalidó.
 *
 * Respuestas: correcto → 204 + cookie `stepup_sello` · incorrecto → 401 con
 * intentos restantes · 5 fallos → 429 (el código muere, hay que pedir otro) ·
 * vencido → 403 · sin código vigente → 401. Todo queda en AuditLog SIN el
 * código (servicio `stepup-codigo`).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { requireEnv } from "@/lib/env";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getParametroSistemaValor } from "@/lib/parametros";
import { firmarSelloStepUp, NOMBRE_COOKIE_STEPUP } from "@/lib/routing/stepup-sello";
import { verificarCodigoStepUp } from "@/lib/dal/services/stepup-codigo";

const bodySchema = z.object({
    codigo: z.string().trim().regex(/^\d{6}$/, "El código tiene 6 dígitos"),
});

export async function POST(request: Request) {
    try {
        const usuario = await verifyAuth("PARENT");
        const parsed = bodySchema.safeParse(await request.json().catch(() => undefined));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Escribe el código de 6 dígitos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const rate = await checkRateLimit(request, "stepup_verificar", { identifier: usuario.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiados intentos. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const resultado = await verificarCodigoStepUp({
            usuarioId: usuario.id,
            codigo: parsed.data.codigo,
            ip: getClientIp(request),
        });

        if (resultado.estado === "incorrecto") {
            return NextResponse.json(
                {
                    error: {
                        message: `Código incorrecto. Te ${resultado.intentosRestantes === 1 ? "queda" : "quedan"} ${resultado.intentosRestantes} ${resultado.intentosRestantes === 1 ? "intento" : "intentos"}.`,
                        code: ERROR_CODES.AUTH_INVALID,
                    },
                },
                { status: 401 }
            );
        }
        if (resultado.estado === "bloqueado") {
            return NextResponse.json(
                {
                    error: {
                        message: "Superaste los intentos permitidos. Solicita un código nuevo.",
                        code: ERROR_CODES.RATE_LIMITED,
                    },
                },
                { status: 429 }
            );
        }
        if (resultado.estado === "expirado") {
            return NextResponse.json(
                {
                    error: {
                        message: "El código venció. Solicita uno nuevo.",
                        code: ERROR_CODES.FORBIDDEN,
                    },
                },
                { status: 403 }
            );
        }
        if (resultado.estado === "sin_codigo") {
            return NextResponse.json(
                {
                    error: {
                        message: "Código incorrecto o vencido. Solicita uno nuevo.",
                        code: ERROR_CODES.AUTH_INVALID,
                    },
                },
                { status: 401 }
            );
        }

        // Verificado: el sello vive lo que diga `padre.texto.stepup_minutos`
        // (mismo parámetro que gobernaba la vía por contraseña).
        const minutos = parseInt((await getParametroSistemaValor("padre.texto.stepup_minutos")) ?? "30", 10);
        const vidaSeg = (Number.isFinite(minutos) && minutos > 0 ? minutos : 30) * 60;

        const res = new NextResponse(null, { status: 204 });
        res.cookies.set(NOMBRE_COOKIE_STEPUP, firmarSelloStepUp(usuario.id, requireEnv("JWT_SECRET", 32)), {
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.COOKIE_SECURE !== "false",
            maxAge: vidaSeg,
            path: "/",
        });
        return res;
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
