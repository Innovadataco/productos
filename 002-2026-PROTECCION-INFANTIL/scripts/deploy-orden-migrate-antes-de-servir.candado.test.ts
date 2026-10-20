/**
 * CANDADO · SPEC-877 (I-391) · el deploy aplica las MIGRACIONES antes de SERVIR el código nuevo.
 *
 * Defecto: `deploy-prod.sh` hacía `$COMPOSE up -d` (app+worker+db con la imagen NUEVA) y DESPUÉS
 * `migrate deploy` → ventana donde la app sirve el código nuevo contra el SCHEMA VIEJO; una escritura que
 * espera la columna nueva FALLA en prod. Invariante: las migraciones se aplican ANTES de que cualquier
 * contenedor que SIRVE (app/worker) arranque con la imagen nueva. Como `migrate` corre CON la imagen de la
 * app, el patrón es un contenedor de UN SOLO USO (`run --rm`), no `exec` sobre un contenedor que ya sirve.
 *
 * Lint/test del ORDEN (scan del script, no ejecuta docker):
 *  (1) `migrate deploy` corre vía `$COMPOSE run` (un solo uso), NUNCA `$COMPOSE exec` (contenedor que sirve).
 *  (2) ningún `up -d` que levante SERVICIO (app/worker, o `up -d` pelado = todos) ocurre ANTES de `migrate
 *      deploy`. Lo único permitido antes es `up -d db` (solo la base, no sirve).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const lineas = readFileSync(resolve(__dirname, "../scripts/deploy-prod.sh"), "utf-8").split("\n");
const esComentario = (l: string) => l.trimStart().startsWith("#");
const idx = (re: RegExp) => lineas.findIndex((l) => !esComentario(l) && re.test(l));

/** `$COMPOSE up -d <args>` → los args (vacío = todos los servicios). null si la línea no es un `up -d`. */
function argsUp(linea: string): string | null {
    if (esComentario(linea)) return null;
    const m = linea.match(/\$COMPOSE\s+up\s+-d\b(.*)$/);
    return m ? m[1].trim() : null;
}
/** Un `up -d` SIRVE si no se limita a la base (`db`): pelado (todos) o con app/worker. */
function sirve(args: string): boolean {
    return args === "" || /\b(app|worker)\b/.test(args);
}

describe("SPEC-877 (I-391) · deploy-prod.sh migra ANTES de servir", () => {
    const idxMigrate = idx(/migrate deploy/);

    it("existe un `migrate deploy` en el deploy", () => {
        expect(idxMigrate, "no encontré `migrate deploy` en deploy-prod.sh").toBeGreaterThanOrEqual(0);
    });

    it("(1) `migrate deploy` corre en un contenedor de UN SOLO USO (`run --rm`), no `exec` sobre uno que sirve", () => {
        const linea = lineas[idxMigrate];
        expect(linea, `migrate NO usa \`run\` (un solo uso): «${linea.trim()}»`).toMatch(/\$COMPOSE\s+run\b/);
        expect(linea, `migrate usa \`exec\` → corre en un contenedor que YA sirve (defecto I-391): «${linea.trim()}»`).not.toMatch(/\$COMPOSE\s+exec\b/);
    });

    it("(2) ningún `up -d` que SIRVA (app/worker/todos) ocurre antes de `migrate deploy` (solo `up -d db`)", () => {
        const antesQueSirven = lineas
            .map((l, i) => ({ l, i, args: argsUp(l) }))
            .filter((x) => x.args !== null && x.i < idxMigrate && sirve(x.args!));
        expect(
            antesQueSirven.map((x) => `${x.i + 1}: ${x.l.trim()}`),
            "hay un `up -d` que levanta app/worker ANTES de migrar → sirve el código nuevo con el schema viejo (I-391). Antes de migrar solo se permite `up -d db`.",
        ).toEqual([]);
    });
});
