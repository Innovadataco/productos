/**
 * SPEC-592 (2026-09-08) — POST /api/padre/step-up/verificar.
 *
 * Canjea el código temporal enviado al correo (cuentas OAuth sin contraseña).
 * Si el código firma bien, pertenece al usuario autenticado y no venció
 * (10 minutos), se emite el MISMO sello step-up de la vía por contraseña: la
 * autoridad posterior (`GET /api/padre/reportes/[id]/texto`) no distingue cómo
 * se revalidó, solo que se revalidó.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { requireEnv } from "@/lib/env";
import { getParametroSistemaValor } from "@/lib/parametros";
import { firmarSelloStepUp, leerCodigoStepUpEmail, NOMBRE_COOKIE_STEPUP } from "@/lib/routing/stepup-sello";

const bodySchema = z.object({ codigo: z.string().min(1, "Escribe el código") });

export async function POST(request: Request) {
    try {
        const usuario = await verifyAuth("PARENT");
        const parsed = bodySchema.safeParse(await request.json().catch(() => undefined));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Escribe el código", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const payload = leerCodigoStepUpEmail(parsed.data.codigo.trim(), usuario.id, requireEnv("JWT_SECRET", 32));
        if (!payload) {
            return NextResponse.json(
                { error: { message: "Código incorrecto o vencido. Solicita uno nuevo.", code: ERROR_CODES.AUTH_INVALID } },
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
