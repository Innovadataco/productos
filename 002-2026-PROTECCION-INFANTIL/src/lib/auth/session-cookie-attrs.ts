/**
 * Atributos de la cookie de sesión, AISLADOS (sin Prisma ni env pesado).
 *
 * Fuente ÚNICA de los atributos (Spec 106): la creación (login) y el borrado (logout) usan los MISMOS
 * — un Set-Cookie de borrado sin ellos lo rechaza el navegador (el prefijo __Host- exige Secure +
 * Path=/). Se extrajo de `auth.ts` para poder importarla/probarla en aislamiento, sin arrastrar la
 * cadena de `@/lib/auth` (audit → anti-abuso → requireEnv(ANTI_ABUSO_SALT)); `auth.ts` la re-exporta,
 * los llamadores (`setSessionCookie`, logout, /api/me) no cambian su import.
 *
 * SameSite=Strict a propósito (D-131): bajo Strict, ningún GET que mute estado es alcanzable por
 * navegación cross-site — y este producto tiene ~18 GET que escriben AuditLog/LecturaReporte («tal
 * admin leyó el reporte X»). Aflojar a Lax dejaría a un tercero ENSUCIAR esa bitácora desde fuera,
 * rompiendo la garantía de auditoría-por-lectura (D-129/SPEC-611). Por eso se queda en Strict; no
 * aflojar sin el chequeo de Origin (SPEC-619). (La entrada es solo correo+contraseña, same-site —
 * SPEC-647/D-136 sacó Google; ya no hay retorno cross-site que compensar.)
 */
export function sessionCookieAttributes(secure: boolean) {
    return {
        httpOnly: true,
        secure,
        // `secure ? strict : lax`: en prod (secure) es Strict y protege la bitácora de auditoría de los
        // GET cross-site (D-129/SPEC-611); en DESARROLLO local NO es `secure` → `lax`. NO aflojar prod a
        // Lax sin el chequeo de Origin (SPEC-619).
        sameSite: secure ? ("strict" as const) : ("lax" as const),
        path: "/",
    };
}
