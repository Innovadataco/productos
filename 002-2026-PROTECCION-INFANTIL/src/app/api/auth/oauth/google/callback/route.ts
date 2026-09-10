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
import { construirAterrizajeOAuth, origenPublicoPuente } from "@/lib/auth/puente-aterrizaje-oauth";
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

        // El origen público sale de NEXT_PUBLIC_APP_URL (estricto, aborta ruidoso si falta): NUNCA de
        // request.url, que dentro de Docker refleja el host interno (0.0.0.0:3000) y mandaría el
        // aterrizaje a la nada SIN error (I-361). `origenPublicoPuente` lo gatea.
        //
        // SPEC-588: la cuenta NUEVA aterriza en /consentimiento (Paso 1 del camino); la
        // EXISTENTE, en homeParaRol(rol). Ambas son rutas DESPUÉS del login, no el login.
        //
        // SPEC-608 (I-371): se sella `sesion_estado` en AMBAS ramas (antes solo la NUEVA).
        // Importa porque la cuenta existente aterriza en /dashboard/padre —ruta GATEADA—:
        // sin la cookie, el middleware rebota a /api/sesion/al-dia y, si el re-sello no pega
        // en el cliente (visto en prod), el loop-cap (SPEC-572) termina en /login con la
        // sesión YA creada —el encabezado saluda al usuario parado en el login—. Es el MISMO
        // mecanismo que SPEC-588 evitó un piso más arriba yendo a /consentimiento (ruta de
        // sesión, que no lee esa cookie), pero seguía vivo en la rama existente. Sellar acá
        // hace que el destino —gateado o no— NO dependa del rebote: el middleware lee el
        // estado y sirve la página (o el muro de consentimiento/password/vigencia que
        // corresponda), nunca el login.
        const origen = origenPublicoPuente();
        const destino = esNuevo ? "/consentimiento" : homeParaRol(usuario.rol);
        // SPEC-617 (I-371 · D-131): PUENTE same-site, NO un 302 cross-site. El JWT es SameSite=Strict a
        // propósito (protege la bitácora de auditoría de GET cross-site). Un redirect al destino
        // heredaría el origen cross-site del retorno de Google → el navegador NO mandaría el JWT recién
        // sellado → el Paso 2 del middleware no lo ve → /login (esa era I-371). Esta página (mismo
        // origen) navega ELLA MISMA al destino: la navegación es same-site, el JWT Strict viaja y el
        // middleware lo ve. `destino` se deriva del ROL en el servidor (homeParaRol / consentimiento),
        // nunca de la URL → no es un redirector abierto.
        const res = construirAterrizajeOAuth(new URL(destino, origen).toString());
        // El state es de un solo uso: se borra con los mismos atributos.
        res.cookies.set(OAUTH_STATE_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });

        // Sella el estado de sesión para que el destino no dependa del rebote del middleware.
        // Fallo suave (sellarCookieSesionEstado devuelve false y no bloquea): en el peor caso
        // cae al rebote de antes — estrictamente no peor que la conducta previa.
        await sellarCookieSesionEstado(res, usuario.id);

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
