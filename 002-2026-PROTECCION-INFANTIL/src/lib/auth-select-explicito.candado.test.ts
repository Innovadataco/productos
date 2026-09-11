/**
 * CANDADO · SPEC-672 (I-399) — el camino de autenticación NUNCA lee el Usuario sin `select`.
 *
 * Sobre la FORMA de la consulta, no sobre una columna: un candado que vigilara
 * `notificacionesCirculo` no serviría para la PRÓXIMA columna — y la próxima es
 * exactamente el caso que esto previene.
 *
 * El defecto (I-399): sin `select`, Prisma nombra TODOS los escalares de `Usuario`
 * en el SELECT. El día que se borra una columna, `verifyAuth` (que gatea
 * /api/reportes) pide una columna inexistente → P2022. Y en `getUserFromToken` /
 * `getSessionUser` el `catch` se lo traga → `user = null` → 403 «sesión no válida»:
 * un error de esquema disfrazado de expiración, sin log ni alarma, que el propio
 * usuario lee como algo suyo. El alta de reportes cae en silencio.
 *
 * Con `select` explícito, un DROP de columna de `Usuario` que el auth no nombra es
 * inofensivo, y los despliegues vuelven al orden normal (sin defer, sin dos ventanas).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "../..");

/** Fuente sin comentarios: el docblock que NOMBRA el defecto no puede darlo por bueno. */
function leerCodigo(rel: string): string {
    return fs
        .readFileSync(path.join(RAIZ, rel), "utf-8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n");
}

const PORQUE =
    "El camino de autenticación (auth.ts) NO puede leer el Usuario sin `select`. Sin " +
    "él Prisma nombra todos los escalares y un DROP de columna tumba verifyAuth (que " +
    "gatea /api/reportes) con el P2022 tragado como 403 «sesión no válida» — degradación " +
    "en silencio. Nombrá los campos (select), no todos los escalares.";

describe("SPEC-672 · el camino de autenticación lee el Usuario con select explícito", () => {
    const AUTH = leerCodigo("src/lib/auth.ts");

    it("toda consulta `usuario.findUnique/findFirst` en auth.ts tiene `select`", () => {
        const llamadas = [...AUTH.matchAll(/prisma\.usuario\.(findUnique|findFirst)\s*\(/g)];
        // Las tres del camino de auth: getUserFromToken, getSessionUser, verifyAuth.
        expect(llamadas.length, "esperaba las 3 consultas del camino de auth en auth.ts").toBeGreaterThanOrEqual(3);
        for (const m of llamadas) {
            const desde = m.index ?? 0;
            const cierre = AUTH.indexOf("});", desde);
            const bloque = cierre === -1 ? AUTH.slice(desde) : AUTH.slice(desde, cierre);
            expect(/\bselect\s*:/.test(bloque), `${PORQUE}\n(consulta sin select cerca de: ${AUTH.slice(desde, desde + 60)}…)`).toBe(true);
        }
    });

    it("el select del auth es un conjunto acotado, no todos los escalares", () => {
        // El select vive en una constante compartida y NO nombra escalares que el auth
        // no consume (p. ej. los de notificaciones/consentimiento). Si alguien lo
        // rellenara con todo, volvería el defecto por otra puerta.
        expect(/USUARIO_AUTH_SELECT\s*=\s*\{/.test(AUTH), "el select debe ser una constante compartida").toBe(true);
        for (const escalarNoUsado of ["notificacionesHijos", "consentimientoIP", "urgenciaEstandar", "intentosFallidos"]) {
            expect(
                new RegExp(`${escalarNoUsado}\\s*:\\s*true`).test(AUTH),
                `${escalarNoUsado} no lo consume el auth: no debe entrar al select o el DROP vuelve a ser peligroso.`,
            ).toBe(false);
        }
    });
});
