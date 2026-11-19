/**
 * SPEC-924 · Una rama `work/pi-SPEC-N-*` exige `specs/N-<slug>/spec.md` con línea `Status`.
 *
 * Hueco real que cierra: SPEC-921 (PR #918) mergeó SIN `spec.md` y la revisión no lo vio.
 * Una rama de PI que declara un número de SPEC tiene que traer su nota con Status del
 * catálogo canónico (el mismo de `specs-discipline.test.ts` y `generar-readme.ts`).
 *
 * Corre en el job `verificar_base` (`.github/workflows/verificar-base-pr.yml`), que es check
 * REQUERIDO del ruleset «Gate CI - main» y corre en TODO PR (incluso los que solo tocan
 * workflows, que el `should-skip` de `ci.yml` podría saltar) → BLOQUEA el merge.
 *
 * Alcance:
 *   - Solo ramas `work/pi-SPEC-N-*`. Las de BI (`work/bi-…`) y cualquier otra → se saltan (ok).
 *   - Las ramas de los bots (`work/pi-SPEC-487-generados`, `work/pi-SPEC-466-tension`) pasan
 *     porque sus specs (487/466) existen con Status — no hay excepción por nombre.
 *
 * Puro + CLI. Sin dependencias (corre con el `node` del runner, sin `npm ci`).
 * Uso: node scripts/ci/verificar-spec-de-rama.mjs "<rama>" [<dir specs>]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const STATUS_CANONICOS = new Set([
    "PLANEADO",
    "DESARROLLO",
    "IMPLEMENTADO",
    "PENDIENTE DE PRUEBA",
    "FINALIZADO",
    "CERRADA",
]);

const RAMA_PI = /^work\/pi-SPEC-([0-9]+)-/;

/** Mismo regex tolerante que `specs-discipline.test.ts` / `generar-readme.ts`. */
export function statusDe(contenido) {
    const m = contenido.match(/(?:Status|Estado)\**[:：]\s*\*?\*?`?([A-ZÁÉÍÓÚa-z][A-ZÁÉÍÓÚa-z ]*?)(?:`|\*|$|\(|\||\.)/m);
    return m ? m[1].trim() : null;
}

/**
 * @param {string} rama  head ref del PR
 * @param {string} specsDir  carpeta `specs/` del producto
 * @returns {{ ok: boolean, aplica: boolean, motivo: string }}
 */
export function verificarSpecDeRama(rama, specsDir) {
    const m = RAMA_PI.exec(rama ?? "");
    if (!m) return { ok: true, aplica: false, motivo: `rama '${rama}' no es work/pi-SPEC-N-* → no aplica` };
    const numero = parseInt(m[1], 10);
    const carpetas = existsSync(specsDir)
        ? readdirSync(specsDir, { withFileTypes: true })
            .filter((e) => e.isDirectory() && /^[0-9]+-/.test(e.name) && parseInt(e.name, 10) === numero)
            .map((e) => e.name)
        : [];
    if (carpetas.length === 0) {
        return { ok: false, aplica: true, motivo: `SPEC-${numero}: no existe specs/${numero}-*/spec.md` };
    }
    const problemas = [];
    for (const c of carpetas) {
        const spec = join(specsDir, c, "spec.md");
        if (!existsSync(spec)) {
            problemas.push(`specs/${c}/ no tiene spec.md`);
            continue;
        }
        const status = statusDe(readFileSync(spec, "utf-8"));
        if (status === null) {
            problemas.push(`specs/${c}/spec.md no tiene línea Status`);
            continue;
        }
        if (!STATUS_CANONICOS.has(status)) {
            problemas.push(`specs/${c}/spec.md Status "${status}" fuera de catálogo`);
            continue;
        }
        return { ok: true, aplica: true, motivo: `SPEC-${numero}: specs/${c}/spec.md · Status ${status}` };
    }
    return { ok: false, aplica: true, motivo: `SPEC-${numero}: ${problemas.join("; ")}` };
}

const esCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esCli) {
    const rama = process.argv[2] ?? "";
    const specsDir = process.argv[3] ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../specs");
    const r = verificarSpecDeRama(rama, specsDir);
    if (r.ok) {
        console.log(`✅ ${r.motivo}`);
    } else {
        console.error(`❌ ${r.motivo}`);
        console.error("Una rama work/pi-SPEC-N-* exige specs/N-<slug>/spec.md con «**Status**: <catálogo>» (SPEC-924).");
        process.exitCode = 1;
    }
}
