/**
 * SPEC-598 (08-09-2026) — POST /api/auth/crear-password.
 *
 * Primera contraseña local de una cuenta OAuth (Google) sin clave propia.
 * NO pide contraseña actual (no existe): pide la nueva dos veces + el código de
 * un solo uso enviado a SU correo (POST /api/auth/crear-password/codigo), que
 * confirma posesión. Al crearla la cuenta queda con AMBOS métodos de acceso
 * (Google + email/contraseña) y desde entonces «Cambiar contraseña» funciona
 * normal. Verificación y actualización del hash viven en el DAL (SPEC-053).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { requireEnv } from "@/lib/env";
import { getParametroSistema } from "@/lib/parametros";
import { AutenticacionService } from "@/lib/dal/services/autenticacion";
import { enviarEmailCambioPassword } from "@/lib/email";
import { logger } from "@/lib/logger";
import { logAudit } from "@/lib/audit";
import { leerCodigoCrearPassword } from "@/lib/routing/stepup-sello";
import { AccionAudit } from "@prisma/client";

const schemaBase = z.object({
    codigo: z.string().min(1),
    passwordNueva: z.string().max(100),
    passwordConfirmar: z.string().max(100),
});

export async function POST(request: Request) {
    try {
        const user = await verifyAuth();
        const body = await request.json();
        const parsed = schemaBase.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // Solo cuentas OAuth SIN contraseña propia; las demás usan «Cambiar contraseña».
        if (user.googleSub === null || user.passwordCreadaEn !== null) {
            return NextResponse.json(
                { error: { message: "Tu cuenta ya tiene contraseña. Usa «Cambiar contraseña».", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const { codigo, passwordNueva, passwordConfirmar } = parsed.data;

        if (passwordNueva !== passwordConfirmar) {
            return NextResponse.json(
                { error: { message: "Las contraseñas nuevas no coinciden", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // Spec 095-US2: longitud mínima de contraseña desde parámetro (security.password_min_length, fallback 8)
        const paramMin = await getParametroSistema("security.password_min_length");
        const minLength = parseInt(paramMin?.valor ?? "8", 10);
        if (passwordNueva.length < minLength) {
            return NextResponse.json(
                { error: { message: `La contraseña debe tener al menos ${minLength} caracteres`, code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // La posesión del correo ES el factor: sin código válido no hay creación.
        const payload = leerCodigoCrearPassword(codigo.trim(), user.id, requireEnv("JWT_SECRET", 32));
        if (!payload) {
            return NextResponse.json(
                { error: { message: "Código incorrecto o vencido. Solicita uno nuevo.", code: ERROR_CODES.AUTH_INVALID } },
                { status: 401 }
            );
        }

        const resultado = await new AutenticacionService().crearPassword({
            usuarioId: user.id,
            passwordNueva,
            googleSub: user.googleSub,
            passwordCreadaEn: user.passwordCreadaEn,
        });

        if (!resultado.ok) {
            return NextResponse.json(
                { error: { message: "Tu cuenta ya tiene contraseña. Usa «Cambiar contraseña».", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        // Aviso de seguridad al dueño de la cuenta (patrón SPEC-322/SPEC-415):
        // un fallo de correo no rompe la creación, pero deja rastro.
        try {
            await enviarEmailCambioPassword(user.email);
        } catch (error) {
            logger.error(
                "[Seguridad] No se pudo avisar el cambio de clave (el usuario crea su clave)",
                error,
            );
        }

        // US5 · SPEC-318: la acción canónica del cambio/creación de contraseña.
        await logAudit({
            accion: AccionAudit.USUARIO_CAMBIO_PASSWORD,
            tipoRecurso: "Usuario",
            recursoId: user.id,
            usuarioId: user.id,
        });

        return NextResponse.json({ ok: true });
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
