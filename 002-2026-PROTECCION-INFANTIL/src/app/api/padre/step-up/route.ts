/**
 * SPEC-340 (A-68 §3.3-bis) — POST /api/padre/step-up.
 *
 * Revalida la contraseña del padre para revelar texto sensible con sesión
 * vieja. NUNCA el correo (fricción excesiva, no estándar — brief). Reusa
 * `AutenticacionService.login` COMPLETO: mismo contador global de intentos,
 * mismo bloqueo parametrizado — cero contadores paralelos (Calidad R1).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { requireEnv } from "@/lib/env";
import { AutenticacionService } from "@/lib/dal/services/autenticacion";
import { getParametroSistemaValor } from "@/lib/parametros";
import { firmarSelloStepUp, NOMBRE_COOKIE_STEPUP } from "@/lib/routing/stepup-sello";

const bodySchema = z.object({ password: z.string().min(1, "Escribe tu contraseña") });

export async function POST(request: Request) {
    try {
        const usuario = await verifyAuth("PARENT");
        const parsed = bodySchema.safeParse(await request.json().catch(() => undefined));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Escribe tu contraseña", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // El login del servicio: contador global, bloqueo, todo incluido.
        const resultado = await new AutenticacionService().login(usuario.email, parsed.data.password);
        if (!resultado.ok) {
            const mensaje =
                resultado.tipo === "bloqueada"
                    ? "Tu cuenta quedó protegida por varios intentos. Espera un momento e intenta de nuevo."
                    : "Esa no es tu contraseña. Inténtalo otra vez, con calma.";
            return NextResponse.json(
                { error: { message: mensaje, code: ERROR_CODES.AUTH_INVALID } },
                { status: 401 }
            );
        }

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
