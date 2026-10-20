/**
 * CANDADO · SPEC-885 / I-443 · el barrido de generados CONVERGE y AVISA de verdad.
 *
 * Dos defectos del workflow `generados-post-merge.yml` (SPEC-487):
 *  1. NO CONVERGÍA: en cada push a main hacía `git push --force` de la rama del barrido, SIEMPRE.
 *     Si el operador ya tenía el PR abierto, el force-push le reseteaba los checks/aprobación →
 *     pedía re-aprobación eterna, nunca cerraba.
 *  2. AVISO FANTASMA: el único «aviso» era un `::notice` en el log de Actions — nadie lo ve.
 *
 * Fix (decisión del CEO: el bot NO abre su propio PR — flujo B):
 *  (1) CONVERGENCIA: antes de pushear se consulta si YA hay un PR abierto del barrido; si lo hay,
 *      NO se re-pushea (consistencia eventual; al mergear ese PR, el próximo push re-dispara). Sin
 *      tocar ningún gate.
 *  (2) NOTIFICACIÓN REAL: un Issue de GitHub con label fijo `generados-drift` (el operador lo
 *      encuentra con `gh issue list --label generados-drift`), REUSADO si ya hay uno abierto (no
 *      spamear uno por push). Requiere `issues: write` + `pull-requests: read`.
 *
 * Candado de FUENTE sobre el YAML (correr el workflow es de GitHub Actions, no reproducible local).
 * Muere con el defecto por MUTACIÓN: quitar el gating por PR-abierto, el `gh issue create`, o el
 * permiso `issues: write` reenciende el candado. Control positivo sintético incluido.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const YML = resolve(__dirname, "../../../.github/workflows/generados-post-merge.yml"); // raíz del monorepo
const wf = readFileSync(YML, "utf8");

describe("SPEC-885 / I-443 · el barrido de generados converge y avisa de verdad", () => {
    it("el job pide los permisos del aviso + detección de PR (issues:write, pull-requests:read)", () => {
        expect(wf, "falta issues: write (para abrir/reusar el Issue)").toMatch(/issues:\s*write/);
        expect(wf, "falta pull-requests: read (para detectar el PR abierto)").toMatch(/pull-requests:\s*read/);
    });

    it("CONVERGENCIA: detecta un PR abierto del barrido y gatea el push con eso", () => {
        // Hay un paso que consulta los PR abiertos de la rama del barrido.
        expect(
            wf,
            "falta la consulta `gh pr list --head work/pi-SPEC-487-generados --state open`",
        ).toMatch(/gh pr list[\s\S]*?--head\s+work\/pi-SPEC-487-generados[\s\S]*?--state\s+open/);
        // Y el push/aviso NO corre si ya hay PR abierto (no re-pushea sobre un PR en revisión).
        expect(
            wf,
            "el paso de push/aviso debe gatearse en `steps.pr.outputs.abierto == '0'`",
        ).toMatch(/if:[^\n]*steps\.pr\.outputs\.abierto\s*==\s*'0'/);
    });

    it("NOTIFICACIÓN REAL: abre un Issue con label fijo `generados-drift`, reusándolo (no ::notice solo)", () => {
        expect(wf, "falta `gh issue create ... --label generados-drift` (el aviso real)").toMatch(
            /gh issue create[\s\S]*?--label\s+generados-drift/,
        );
        // Reuso (no spam): se busca un Issue abierto con el label y, si existe, se comenta.
        expect(wf, "debe reusar: `gh issue list --label generados-drift --state open`").toMatch(
            /gh issue list[\s\S]*?--label\s+generados-drift[\s\S]*?--state\s+open/,
        );
        expect(wf, "debe comentar el Issue reusado en vez de abrir otro").toMatch(/gh issue comment/);
    });

    it("control positivo: un YAML viejo (solo ::notice, push incondicional) sería ROJO", () => {
        const viejo = [
            "      - name: Pushear la rama y avisar al operador",
            "        if: steps.diff.outputs.cambio == 'si'",
            "        run: |",
            "          git push --force origin \"$RAMA\"",
            "          echo \"::notice::driftearon\"",
        ].join("\n");
        // El detector del aviso real (gh issue create con label) NO casa sobre el YAML viejo.
        expect(/gh issue create[\s\S]*?--label\s+generados-drift/.test(viejo)).toBe(false);
        // Y el gating por PR-abierto tampoco.
        expect(/steps\.pr\.outputs\.abierto\s*==\s*'0'/.test(viejo)).toBe(false);
    });
});
