/**
 * SPEC-587 — GET /api/auth/oauth/google/callback.
 *
 * Vuelta de Google: valida el state contra la cookie httpOnly, intercambia el
 * code, lee userinfo y exige email_verified. Resolución de cuenta por email
 * (minúsculas + trim, mismo criterio que el login):
 * - Existe → login directo (JWT 24 h, sesión registrada, vigencia como el login).
 * - No existe → cuenta PARENT nueva con contraseña aleatoria bcrypteada (el
 *   schema exige passwordHash; no hay campo de proveedor, así que el hash
 *   aleatorio imposible de adivinar ES la ausencia de clave local) + AuditLog.
 * - Existe con OTRO rol → login igual: es su cuenta, el rol manda.
 *
 * Destino: homeParaRol (fuente única SPEC-319) para cuentas existentes;
 * la cuenta NUEVA va directo a /consentimiento (Paso 1, SPEC-588) y sella
 * además la cookie sesion_estado, como /registro/completar.
 */
import { NextResponse } from "next/server";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createToken, setSessionCookie } from "@/lib/auth";
import { homeParaRol } from "@/lib/auth/home-para-rol";
import { AutenticacionOauthService } from "@/lib/dal/services/autenticacion-oauth";
import { SessionLogService } from "@/lib/dal/services/session-log";
import { sellarCookieSesionEstado } from "@/lib/routing/sellar-sesion-estado";
import {
    callbackUriDe,
    intercambiarCodePorToken,
    obtenerInfoUsuarioGoogle,
    OAUTH_STATE_COOKIE,
    verificarState,
} from "@/lib/auth-oauth";

function leerStateCookie(request: Request): string | null {
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${OAUTH_STATE_COOKIE}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : null;
}

export async function GET(request: Request) {
    try {
        const rate = await checkRateLimit(request, "oauth_google");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiados intentos. Intenta más tarde.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const stateCookie = leerStateCookie(request);

        // CSRF: el state firmado debe coincidir con la cookie de arranque.
        if (!code || !state || !stateCookie || state !== stateCookie || !verificarState(state)) {
            return NextResponse.json(
                { error: { message: "La sesión de registro expiró o no es válida. Intenta de nuevo.", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const accessToken = await intercambiarCodePorToken(code, callbackUriDe(request));
        const info = await obtenerInfoUsuarioGoogle(accessToken);

        if (!info.emailVerified) {
            return NextResponse.json(
                { error: { message: "Tu correo de Google no está verificado. Verifícalo en tu cuenta de Google e intenta de nuevo.", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        // Mismo criterio del login (AutenticacionService): minúsculas + trim;
        // la resolución/creación vive en el DAL (frontera Q-3).
        const { usuario, esNuevo } = await new AutenticacionOauthService().resolverODeCrearCuenta({
            email: info.email,
            nombre: info.nombre ?? null,
            proveedorSub: info.sub,
            ipAddress: getClientIp(request),
            userAgent: request.headers.get("user-agent") ?? "unknown",
        });

        if (!esNuevo && usuario.estado !== "activo") {
            return NextResponse.json(
                { error: { message: "Cuenta desactivada. Contacta con el soporte para reactivarla.", code: ERROR_CODES.AUTH_INVALID } },
                { status: 401 }
            );
        }

        // Paridad con POST /api/auth/login (SPEC-119): la vigencia corta el acceso.
        if (!esNuevo && (usuario.rol === "SCHOOL_ADMIN" || usuario.rol === "PARENT" || usuario.rol === "COMITE_CONVIVENCIA")) {
            const { verificarVigenciaCliente } = await import("@/lib/colegio/vigencia");
            const vigencia = await verificarVigenciaCliente(usuario.id);
            if (!vigencia.vigente) {
                return NextResponse.json(
                    { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                    { status: 403 }
                );
            }
        }

        // La cuenta nueva sigue el molde de /registro/completar: sin sesionLogId
        // (la sesión registrada exigiría fila previa); la existente registra sesión
        // como el login, así verifyAuth valida su ciclo de vida.
        let sesionLogId: string | undefined;
        if (!esNuevo) {
            sesionLogId = await new SessionLogService().registrarInicioSesion(request, {
                id: usuario.id,
                rol: usuario.rol,
            });
        }
        const token = await createToken({
            sub: usuario.id,
            rol: usuario.rol,
            ...(sesionLogId ? { sesionLogId } : {}),
        });
        await setSessionCookie(request, token);

        // El origen público sale de NEXT_PUBLIC_APP_URL: request.url refleja el
        // host interno del contenedor (0.0.0.0:3000) detrás del reverse proxy.
        // SPEC-588: la cuenta NUEVA aterriza DIRECTO en /consentimiento (Paso 1
        // del camino), no en homeParaRol: /consentimiento es pública y valida el
        // token en la página, así el Paso 1 funciona con o sin la cookie
        // sesion_estado que se sella abajo. Antes el hop por /dashboard/padre
        // dependía de esa cookie en el middleware; si el re-sellado fallaba, el
        // loop-cap (SPEC-572) terminaba en /login?mensaje=sesion mostrando el
        // formulario de login a un usuario recién autenticado (visto en vivo).
        const origen = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
        const destino = esNuevo ? "/consentimiento" : homeParaRol(usuario.rol);
        const res = NextResponse.redirect(new URL(destino, origen), 302);
        // El state es de un solo uso: se borra con los mismos atributos.
        res.cookies.set(OAUTH_STATE_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });

        if (esNuevo) {
            // Directo al Paso 1 del camino, como el registro por enlace.
            await sellarCookieSesionEstado(res, usuario.id);
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
