/**
 * SPEC-631 (I-378) — GET /api/auth/oauth/google/registro/profesional.
 *
 * Arranque del OAuth de Google DENTRO del registro de Profesional: firma el rol PROFESIONAL en el state
 * (constante fija de este endpoint, NUNCA de la URL). El profesional nace SIN verificar (igual que por
 * correo): la verificación es downstream. Si el correo ya existe, entra a su rol real (no promueve).
 */
import { arrancarOauthGoogle } from "@/lib/auth/arrancar-oauth-google";

export function GET(request: Request) {
    return arrancarOauthGoogle(request, "PROFESIONAL");
}
