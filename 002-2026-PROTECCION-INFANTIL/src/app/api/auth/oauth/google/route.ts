/**
 * SPEC-587 / SPEC-631 — GET /api/auth/oauth/google.
 *
 * Arranque del OAuth de Google del botón de /login: SOLO AUTENTICA. Firma un state SIN rol → el
 * callback NO crea cuenta si el correo no existe (lo manda a /registro/inicio a clasificarse). El alta
 * por rol vive en `/api/auth/oauth/google/registro/{familia,profesional}`. Lógica compartida en
 * `arrancarOauthGoogle`.
 */
import { arrancarOauthGoogle } from "@/lib/auth/arrancar-oauth-google";

export function GET(request: Request) {
    return arrancarOauthGoogle(request); // sin rol → login
}
