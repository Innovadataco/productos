import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getParametroSistema } from "@/lib/parametros";
import { AutenticacionService } from "@/lib/dal/services/autenticacion";
import { enviarEmailCambioPassword } from "@/lib/email";
import { buildSesionEstadoValue } from "@/lib/routing/sesion-estado-emitter";
import { NOMBRE_COOKIE, TTL_SEG } from "@/lib/routing/vigencia-cookie";

const schemaBase = z.object({
    passwordActual: z.string().min(1),
    passwordNueva: z.string().max(100),
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

        const { passwordActual, passwordNueva } = parsed.data;

        // Spec 095-US2: longitud mínima de contraseña desde parámetro (security.password_min_length, fallback 8)
        const paramMin = await getParametroSistema("security.password_min_length");
        const minLength = parseInt(paramMin?.valor ?? "8", 10);
        if (passwordNueva.length < minLength) {
            return NextResponse.json(
                { error: { message: `La contraseña debe tener al menos ${minLength} caracteres`, code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // SPEC-053: verificación y actualización del hash viven en el DAL; la ruta no toca prisma.
        const resultado = await new AutenticacionService().cambiarPassword({
            usuarioId: user.id,
            passwordActual,
            passwordNueva,
            passwordHashActual: user.passwordHash,
        });

        if (!resultado.ok) {
            return NextResponse.json(
                { error: { message: "Contraseña actual incorrecta", code: ERROR_CODES.AUTH_INVALID } },
                { status: 401 }
            );
        }

        // SPEC-322 (camino 2): aviso de seguridad al dueño de la cuenta.
        // try/catch: un fallo de correo no debe romper el cambio de clave.
        try {
            await enviarEmailCambioPassword(user.email);
        } catch {
            // fallo silencioso — el aviso no es bloqueante
        }

        const res = NextResponse.json({ ok: true });
        try {
            const cookieValue = await buildSesionEstadoValue(user.id);
            res.cookies.set(NOMBRE_COOKIE, cookieValue, {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.COOKIE_SECURE !== "false",
                maxAge: TTL_SEG,
                path: "/",
            });
        } catch {
            // fallo silencioso — la cookie de estado no bloquea el cambio de contraseña
        }
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
