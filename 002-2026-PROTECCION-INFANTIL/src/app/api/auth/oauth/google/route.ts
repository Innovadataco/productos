/**
 * SPEC-587 — GET /api/auth/oauth/google.
 *
 * Arranque del OAuth de Google (flujo PADRE): firma un state, lo guarda en
 * cookie httpOnly corta (10 min) y redirige 302 a accounts.google.com.
 * El correo con enlace de registro sigue intacto debajo del botón.
 */
import { NextResponse } from "next/server";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSecureRequest } from "@/lib/auth";
import {
    buildGoogleAuthUrl,
    callbackUriDe,
    firmarState,
    OAUTH_STATE_COOKIE,
    OAUTH_STATE_TTL_SEG,
} from "@/lib/auth-oauth";

export async function GET(request: Request) {
    try {
        const rate = await checkRateLimit(request, "oauth_google");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiados intentos. Intenta más tarde.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const state = firmarState();
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
            { status: 500 }
        );
    }
}
