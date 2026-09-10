/**
 * Atributos de la cookie de sesión, AISLADOS (sin Prisma ni env pesado).
 *
 * Fuente ÚNICA de los atributos (Spec 106): la creación (login) y el borrado (logout) usan los MISMOS
 * — un Set-Cookie de borrado sin ellos lo rechaza el navegador (el prefijo __Host- exige Secure +
 * Path=/). Se extrajo de `auth.ts` para poder importarla/probarla en aislamiento, sin arrastrar la
 * cadena de `@/lib/auth` (audit → anti-abuso → requireEnv(ANTI_ABUSO_SALT)); `auth.ts` la re-exporta,
 * los llamadores (`setSessionCookie`, logout, /api/me) no cambian su import.
 *
 * SameSite=Strict a propósito (D-131 · SPEC-617): bajo Strict, ningún GET que mute estado es alcanzable
 * por navegación cross-site — y este producto tiene ~18 GET que escriben AuditLog/LecturaReporte
 * («tal admin leyó el reporte X»). Aflojar a Lax dejaría a un tercero ENSUCIAR esa bitácora desde
 * fuera, rompiendo la garantía de auditoría-por-lectura (D-129/SPEC-611). El retorno cross-site de
 * Google (I-371) NO se arregla aflojando la cookie sino con un PUENTE same-site en el callback
 * (`puente-aterrizaje-oauth.ts`): el JWT se queda en Strict.
 */
export function sessionCookieAttributes(secure: boolean) {
    return {
        httpOnly: true,
        secure,
        // `secure ? strict : lax`, y en DESARROLLO local NO es `secure` → ahí sale `lax` y el retorno
        // de Google SÍ funciona: por eso I-371 nunca se vio en dev («a mí me anda»). En prod (secure)
        // es Strict, el retorno cross-site perdía el JWT y caía en /login; lo arregla el puente
        // same-site (`puente-aterrizaje-oauth.ts`), NO aflojar esto a Lax.
        sameSite: secure ? ("strict" as const) : ("lax" as const),
        path: "/",
    };
}
