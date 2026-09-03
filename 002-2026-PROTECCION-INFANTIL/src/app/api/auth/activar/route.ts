import { NextResponse } from "next/server";
import { createToken, setSessionCookie } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { activarSchema } from "@/lib/validators";
import { RegistroColegioService } from "@/lib/dal/services/registro-colegio";
import { enviarEmailCambioPassword } from "@/lib/email";
import { logger } from "@/lib/logger";
import { buildSesionEstadoValue } from "@/lib/routing/sesion-estado-emitter";
import { NOMBRE_COOKIE, TTL_SEG } from "@/lib/routing/vigencia-cookie";
import { logAudit } from "@/lib/audit";
import { AccionAudit } from "@prisma/client";

export async function POST(request: Request) {
    try {
        const bodyRaw = await request.json().catch(() => undefined);
        const parsed = activarSchema.safeParse(bodyRaw);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: parsed.error.issues[0]?.message || "Token y contraseña requeridos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { token, password } = parsed.data;
        const resultado = await new RegistroColegioService().activarPorToken(token, password);

        if (!resultado.ok) {
            const mensaje = resultado.tipo === "expirado"
                ? "El link de activación expiró. Contacta al administrador."
                : "El link de activación no es válido o ya fue usado.";
            return NextResponse.json(
                { error: { message: mensaje, code: ERROR_CODES.AUTH_EXPIRED } },
                { status: 400 }
            );
        }

        const { user } = resultado;
        const sessionToken = await createToken({ sub: user.id, rol: user.rol });
        await setSessionCookie(request, sessionToken);

        // US5 · SPEC-318: auditar activación de cuenta (enum USUARIO_CAMBIO_PASSWORD requiere T003-T005)
        await logAudit({
            accion: AccionAudit.USUARIO_CAMBIO_PASSWORD,
            tipoRecurso: "Usuario",
            recursoId: user.id,
            usuarioId: user.id,
        });

        // SPEC-322 (camino 8): aviso de seguridad al dueño de la cuenta recién activada.
        // try/catch: un fallo de correo no debe romper la activación.
        try {
            await enviarEmailCambioPassword(user.email);
        } catch (error) {
            // SPEC-415: sigue sin bloquear —el cambio de clave ya ocurrió— pero
            // deja de ser MUDO. Este es un aviso de seguridad: si el proveedor
            // está caído (I-283), nadie le dijo al dueño de la cuenta que se la
            // cambiaron, y sin esta línea tampoco quedaba rastro para saberlo.
            logger.error(
                "[Seguridad] No se pudo avisar el cambio de clave (activación de cuenta)",
                error,
            );
        }

        const res = NextResponse.json(
            {
                user: {
                    id: user.id,
                    email: user.email,
                    nombre: user.nombre,
                    rol: user.rol,
                },
            },
            { status: 200 }
        );
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
            // fallo silencioso — la cookie de estado no bloquea la activación
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
