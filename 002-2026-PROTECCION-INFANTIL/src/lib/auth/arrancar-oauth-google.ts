/**
 * SPEC-631 (I-378) — arranque del OAuth de Google, COMPARTIDO por el botón de /login y los de cada
 * registro por rol.
 *
 * El `rol` es un ARGUMENTO FIJO de cada endpoint (una constante del servidor), NUNCA se lee de la URL
 * del usuario: `/api/auth/oauth/google` (login) arranca sin rol; `.../registro/familia` con PARENT y
 * `.../registro/profesional` con PROFESIONAL. Se firma dentro del `state` (HMAC) y el callback lo lee
 * SOLO de ahí. `firmarState` re-valida que el rol sea auto-registrable (defensa en el firmado), y el
 * alta vuelve a validarlo AL CREAR. Sin rol → login: el callback NO crea (SPEC-631, gate 3).
 */
import { NextResponse } from "next/server";
import type { RolUsuario } from "@prisma/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSecureRequest } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { buildGoogleAuthUrl, callbackUriDe, firmarState, OAUTH_STATE_COOKIE, OAUTH_STATE_TTL_SEG } from "@/lib/auth-oauth";

export async function arrancarOauthGoogle(request: Request, rol?: RolUsuario): Promise<NextResponse> {
    try {
        const rate = await checkRateLimit(request, "oauth_google");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiados intentos. Intenta más tarde.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers },
            );
        }

        const state = firmarState(rol); // rol firmado en el state; ausente = login
        const redirect = NextResponse.redirect(buildGoogleAuthUrl(state, callbackUriDe(request)), 302);
        redirect.cookies.set(OAUTH_STATE_COOKIE, state, {
            httpOnly: true,
            sameSite: "lax",
            secure: isSecureRequest(request),
            maxAge: OAUTH_STATE_TTL_SEG,
            path: "/",
        });
        return redirect;
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 },
        );
    }
}
