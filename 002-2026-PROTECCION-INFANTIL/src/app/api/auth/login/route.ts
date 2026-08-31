import { NextResponse } from "next/server";
import { createToken, setSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { loginSchema } from "@/lib/validators";
import { AutenticacionService } from "@/lib/dal/services/autenticacion";
import { SessionLogService } from "@/lib/dal/services/session-log";
import { RolUsuario } from "@prisma/client";
import { buildSesionEstadoValue } from "@/lib/routing/sesion-estado-emitter";
import { NOMBRE_COOKIE, TTL_SEG } from "@/lib/routing/vigencia-cookie";

export async function POST(request: Request) {
    try {
        const rate = await checkRateLimit(request, "login");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiados intentos de inicio de sesión. Intenta más tarde.", code: ERROR_CODES.RATE_LIMITED, retryAfter: Math.ceil((rate.resetAt - Date.now()) / 1000) } },
                { status: 429, headers: rate.headers }
            );
        }

        // SPEC-125: esquema Zod; el mensaje es contrato del frontend (AuthContext).
        const bodyRaw = await request.json().catch(() => undefined);
        const parsed = loginSchema.safeParse(bodyRaw);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: parsed.error.issues[0]?.message || "Email y contraseña requeridos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { email, password } = parsed.data;

        // SPEC-053: credenciales, lockout y actualizaciones de cuenta viven en el DAL;
        // la ruta no toca prisma.
        const resultado = await new AutenticacionService().login(email, password);

        if (!resultado.ok) {
            if (resultado.tipo === "bloqueada") {
                return NextResponse.json(
                    { error: { message: "Cuenta bloqueada temporalmente", code: ERROR_CODES.AUTH_INVALID } },
                    { status: 401 }
                );
            }
            if (resultado.tipo === "inactiva") {
                return NextResponse.json(
                    { error: { message: "Cuenta desactivada. Contacta con el soporte para reactivarla.", code: ERROR_CODES.AUTH_INVALID } },
                    { status: 401 }
                );
            }
            return NextResponse.json(
                { error: { message: "Credenciales inválidas", code: ERROR_CODES.AUTH_INVALID } },
                { status: 401 }
            );
        }

        const user = resultado.user;

        // Verificar vigencia del servicio del cliente (SPEC-119: padres y colegios;
        // SPEC-168: también el Comité de Convivencia). Vencer NO borra nada: solo corta el acceso.
        if (user.rol === "SCHOOL_ADMIN" || user.rol === "PARENT" || user.rol === "COMITE_CONVIVENCIA") {
            const { verificarVigenciaCliente } = await import("@/lib/colegio/vigencia");
            const vigencia = await verificarVigenciaCliente(user.id);
            if (!vigencia.vigente) {
                return NextResponse.json(
                    { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                    { status: 403 }
                );
            }
        }

        const sesionLogId = await new SessionLogService().registrarInicioSesion(request, {
            id: user.id,
            rol: user.rol as RolUsuario,
        });
        const token = await createToken({ sub: user.id, rol: user.rol as RolUsuario, sesionLogId });
        await setSessionCookie(request, token);

        const res = NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                nombre: user.nombre,
                rol: user.rol,
                debeCambiarPassword: user.debeCambiarPassword,
            },
        });
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
            // fallo silencioso — la cookie de estado no bloquea el login
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
