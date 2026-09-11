/**
 * SPEC-587 / SPEC-631 — GET /api/auth/oauth/google/callback.
 *
 * Vuelta de Google: valida el state contra la cookie httpOnly, intercambia el code, lee userinfo y
 * exige email_verified. El `state` firmado trae el ROL (SPEC-631) si el arranque fue un REGISTRO por
 * rol; ausente = botón de /login (solo autentica). Resolución por sub y luego email (mismo criterio del
 * login):
 * - Existe → login a SU rol real. El rol del state NO promueve (nunca se asciende una cuenta existente).
 * - No existe + SIN rol (login) → NO se crea nada: a /registro/inicio a clasificarse.
 * - No existe + CON rol firmado (registro) → se crea con ESE rol, re-validado contra el allowlist AL
 *   CREAR (Datos): un rol privilegiado forjado no crea nada.
 *
 * Destino: cuenta NUEVA de padre → /consentimiento (Paso 1, SPEC-588); todo lo demás → homeParaRol
 * (fuente única SPEC-319). Aterriza por el puente same-site (SPEC-617) y sella `sesion_estado`.
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
    leerState,
} from "@/lib/auth-oauth";

function leerStateCookie(request: Request): string | null {
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${OAUTH_STATE_COOKIE}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : null;
}

function borrarStateCookie(res: NextResponse): void {
    // El state es de un solo uso: se borra con los mismos atributos con que se sembró.
    res.cookies.set(OAUTH_STATE_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
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

        // CSRF: el state firmado debe coincidir con la cookie de arranque. `leerState` trae además el
        // ROL firmado (SPEC-631) — que viaja SOLO acá, en el HMAC, jamás en la URL.
        const { valido, rol } = leerState(state ?? "");
        if (!code || !state || !stateCookie || state !== stateCookie || !valido) {
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

        const origen = origenPublicoPuente();
        const servicio = new AutenticacionOauthService();
        const ipAddress = getClientIp(request);
        const userAgent = request.headers.get("user-agent") ?? "unknown";

        // SPEC-631: PRIMERO resolver (nunca crear). La creación es un paso aparte y condicionado.
        let usuario = await servicio.resolver({ email: info.email, proveedorSub: info.sub });
        let esNuevo = false;
        if (!usuario) {
            if (rol === undefined) {
                // Botón de /login con correo SIN cuenta: clasificarse ANTES de existir. NO se crea nada
                // (así nadie nace padre en silencio). Marca `desde=google` para el banner info de
                // /registro/inicio (SPEC-631 §1 de Diseño). NO es enumeración de SPEC-630: Google ya
                // certificó que la persona controla ESE correo (autoconocimiento, no sondeo de terceros)
                // y el propio destino ya lo revela. El rol NUNCA viaja por la URL (eso sigue en el state).
                // Aterriza por el MISMO puente same-site que las demás salidas (SPEC-617/I-371): esta
                // rama no emite JWT, pero mantener TODA salida en el puente evita que un cambio futuro
                // que sí selle sesión aquí pierda el Strict en el primer salto. Sin excepción al candado.
                const destinoSinCuenta = new URL("/registro/inicio", origen);
                destinoSinCuenta.searchParams.set("desde", "google");
                const aRegistro = construirAterrizajeOAuth(destinoSinCuenta.toString());
                borrarStateCookie(aRegistro);
                return aRegistro;
            }
            // Registro por rol: crear con el rol FIRMADO. `crearConRol` re-valida el allowlist y LANZA
            // si el rol no es auto-registrable (gate 2) → cae al catch (500), sin crear.
            usuario = await servicio.crearConRol({ email: info.email, nombre: info.nombre ?? null, proveedorSub: info.sub, rol, ipAddress, userAgent });
            esNuevo = true;
        }

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

        // La cuenta nueva sigue el molde de /registro/completar: sin sesionLogId (la sesión registrada
        // exigiría fila previa); la existente registra sesión como el login.
        let sesionLogId: string | undefined;
        if (!esNuevo) {
            sesionLogId = await new SessionLogService().registrarInicioSesion(request, { id: usuario.id, rol: usuario.rol });
        }
        const token = await createToken({
            sub: usuario.id,
            rol: usuario.rol,
            ...(sesionLogId ? { sesionLogId } : {}),
        });
        await setSessionCookie(request, token);

        // SPEC-588: la cuenta NUEVA de PADRE aterriza en /consentimiento (Paso 1 del camino); el
        // profesional nuevo y toda cuenta existente, en homeParaRol(rol). SPEC-608/617: se sella
        // `sesion_estado` y se aterriza por el PUENTE same-site (el JWT es Strict; un 302 cross-site lo
        // perdería → /login, que era I-371). `destino` se deriva del ROL en el servidor, nunca de la URL.
        const destino = esNuevo && usuario.rol === "PARENT" ? "/consentimiento" : homeParaRol(usuario.rol);
        const urlDestino = new URL(destino, origen);
        // SPEC-631 §3 (Diseño): intentó el registro de PROFESIONAL con Google pero el correo YA es una
        // cuenta de FAMILIA → entra a su rol real (gate 5, no promueve) y aterriza en su espacio de
        // familia con un aviso «de una vez» (info, descartable) que explica por qué. Solo esa dirección
        // (la que Diseño redactó); otros desajustes de rol no llevan aviso. La marca va por el puente
        // (misma navegación same-site); el rol viaja firmado en el state, nunca en la URL.
        if (rol === "PROFESIONAL" && !esNuevo && usuario.rol === "PARENT") {
            urlDestino.searchParams.set("aviso", "cuenta-familia");
        }
        const res = construirAterrizajeOAuth(urlDestino.toString());
        borrarStateCookie(res);
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
