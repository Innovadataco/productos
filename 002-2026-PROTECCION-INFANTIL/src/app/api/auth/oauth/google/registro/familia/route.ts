/**
 * SPEC-631 (I-378) — GET /api/auth/oauth/google/registro/familia.
 *
 * Arranque del OAuth de Google DENTRO del registro de Familia: firma el rol PARENT en el state (una
 * constante fija de este endpoint, NUNCA leída de la URL). El callback crea con ese rol si el correo no
 * existe; si existe, entra a su rol real (no promueve).
 */
import { arrancarOauthGoogle } from "@/lib/auth/arrancar-oauth-google";

export function GET(request: Request) {
    return arrancarOauthGoogle(request, "PARENT");
}
