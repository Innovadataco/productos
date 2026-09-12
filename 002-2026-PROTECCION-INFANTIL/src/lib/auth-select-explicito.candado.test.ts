/**
 * CANDADO · SPEC-672 (I-399) — el camino de autenticación NUNCA lee el Usuario sin `select`.
 *
 * Sobre la FORMA de la consulta, no sobre una columna: un candado que vigilara
 * `notificacionesCirculo` no serviría para la PRÓXIMA columna — y la próxima es
 * exactamente el caso que esto previene.
 *
 * El defecto (I-399): sin `select`, Prisma nombra TODOS los escalares de `Usuario`.
 * El día que se borra una columna, la consulta pide una columna inexistente → P2022.
 * En `verifyAuth` (que gatea /api/reportes) eso tumba el request; en
 * `getUserFromToken`/`getSessionUser` el `catch` lo traga → 403 «sesión no válida»
 * (error de esquema disfrazado de expiración, sin log ni alarma); y en el LOGIN
 * (`findByEmail`) rompe el inicio de sesión. Con `select`, un DROP de columna que el
 * auth no nombra es inofensivo y los despliegues vuelven al orden normal.
 *
 * ALCANCE = el camino de autenticación COMPLETO, repositorio incluido — no solo
 * `auth.ts`. El defecto vivía repartido: 3 consultas en `auth.ts` (request) + 1 en
 * `UsuarioRepository.findByEmail` (login). Un candado que mira un solo archivo deja
 * la otra consulta sin vigilar (la costura de I-397/I-398/SPEC-674: candado correcto,
 * alcance corto). Por eso este candado mira los DOS archivos del camino de auth.
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

/** Consultas `usuario.findUnique/findFirst` en `fuente` que NO tienen select en su llamada. */
function consultasSinSelect(fuente: string): { total: number; sinSelect: string[] } {
    const llamadas = [...fuente.matchAll(/\.usuario\.(findUnique|findFirst)\s*\(/g)];
    const sinSelect: string[] = [];
    for (const m of llamadas) {
        const desde = m.index ?? 0;
        // El fin de la llamada es el `;` de la sentencia (return/await); las consultas
        // del auth son de una sola sentencia, así que esto abarca todo el objeto de opciones.
        const finSentencia = fuente.indexOf(";", desde);
        const bloque = fuente.slice(desde, finSentencia === -1 ? desde + 300 : finSentencia);
        if (!/\bselect\s*:/.test(bloque)) sinSelect.push(fuente.slice(desde, desde + 70));
    }
    return { total: llamadas.length, sinSelect };
}

/** El bloque `{ … }` de una constante `NOMBRE = { … } satisfies …`. */
function bloqueSelect(fuente: string, nombre: string): string {
    const i = fuente.indexOf(`${nombre} = {`);
    if (i === -1) return "";
    const fin = fuente.indexOf("} satisfies", i);
    return fuente.slice(i, fin === -1 ? i : fin);
}

const PORQUE =
    "El camino de autenticación (auth.ts en cada request + findByEmail en el login) NO " +
    "puede leer el Usuario sin `select`: un DROP de columna tumba verifyAuth (que gatea " +
    "/api/reportes) o el login, y en getUserFromToken/getSessionUser el P2022 se traga " +
    "como 403 «sesión no válida» — degradación en silencio. Nombrá los campos (select).";

// Escalares que NI el request-auth NI el login consumen: si aparecen en un select del
// camino de auth, el DROP de esa columna vuelve a ser peligroso (defecto por otra puerta).
const NUNCA_EN_AUTH = ["consentimientoIP", "urgenciaEstandar", "presentacionEstandar", "documentoNumero", "googleSub"];

describe("SPEC-672 · el camino de autenticación lee el Usuario con select explícito", () => {
    it("auth.ts (request): las 3 consultas del Usuario tienen select", () => {
        const auth = leerCodigo("src/lib/auth.ts");
        const { total, sinSelect } = consultasSinSelect(auth);
        expect(total, "esperaba las 3 consultas del camino de auth en auth.ts").toBeGreaterThanOrEqual(3);
        expect(sinSelect, `${PORQUE}\nauth.ts sin select: ${sinSelect.join(" | ")}`).toEqual([]);
    });

    it("login: UsuarioRepository.findByEmail tiene select (repositorio incluido, no solo auth.ts)", () => {
        const repo = leerCodigo("src/lib/dal/repositories/usuario.ts");
        const idx = repo.indexOf("findByEmail(");
        expect(idx, "no se encontró findByEmail en UsuarioRepository").toBeGreaterThan(-1);
        const sentencia = repo.slice(idx, repo.indexOf(";", idx));
        expect(
            /\bselect\s*:/.test(sentencia),
            `${PORQUE}\nfindByEmail (la consulta del LOGIN) lee el Usuario sin select — el defecto vivía acá, fuera de auth.ts.`,
        ).toBe(true);
    });

    it("los selects del camino de auth son acotados: no nombran escalares que no consume", () => {
        const auth = leerCodigo("src/lib/auth.ts");
        const repo = leerCodigo("src/lib/dal/repositories/usuario.ts");
        const bloqueAuth = bloqueSelect(auth, "USUARIO_AUTH_SELECT");
        const bloqueLogin = bloqueSelect(repo, "USUARIO_LOGIN_SELECT");
        expect(bloqueAuth, "auth.ts debe usar el select compartido USUARIO_AUTH_SELECT").not.toBe("");
        expect(bloqueLogin, "usuario.ts debe usar el select compartido USUARIO_LOGIN_SELECT").not.toBe("");
        for (const escalar of NUNCA_EN_AUTH) {
            expect(
                new RegExp(`${escalar}\\s*:\\s*true`).test(bloqueAuth),
                `${escalar} no lo consume el request-auth: fuera del select, o el DROP vuelve a ser peligroso.`,
            ).toBe(false);
            expect(
                new RegExp(`${escalar}\\s*:\\s*true`).test(bloqueLogin),
                `${escalar} no lo consume el login: fuera del select de findByEmail.`,
            ).toBe(false);
        }
    });
});
