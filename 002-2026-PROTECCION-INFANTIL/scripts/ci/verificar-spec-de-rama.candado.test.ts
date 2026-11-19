/**
 * CANDADO · SPEC-924 — una rama `work/pi-SPEC-N-*` no mergea sin `specs/N-<slug>/spec.md` con Status.
 *
 * Hueco real: SPEC-921 (PR #918) mergeó SIN spec.md y la revisión no lo vio. Este candado amarra:
 *   (1) CONDUCTA del verificador (fixtures en tmp): rama sin carpeta → ROJO; carpeta sin spec.md →
 *       ROJO; spec.md sin Status → ROJO; Status fuera de catálogo → ROJO; con Status → VERDE;
 *       rama bi / no-SPEC → no aplica.
 *   (2) LOS BOTS no se rompen: `work/pi-SPEC-487-generados` y `work/pi-SPEC-466-tension` pasan
 *       contra el `specs/` REAL.
 *   (3) CABLEADO: `verificar-base-pr.yml` (job `verificar_base`, check requerido) invoca el script
 *       con la rama del PR, sin `continue-on-error` → BLOQUEA. Quitar el step → rojo.
 *   (4) Retroactivo: 915/916/918/921 traen su Status (el índice los marcaba «⚠️ sin Status» / 921
 *       no existía).
 *
 * Unit puro (fs + tmp, sin BD) — en `vitest.unit.includes.ts`.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { verificarSpecDeRama } from "./verificar-spec-de-rama.mjs";

type Resultado = { ok: boolean; aplica: boolean; motivo: string };
const verificar = verificarSpecDeRama as (rama: string, dir: string) => Resultado;

const AQUI = dirname(fileURLToPath(import.meta.url));
const SPECS_REAL = resolve(AQUI, "../../specs");
const WORKFLOW = resolve(AQUI, "../../../.github/workflows/verificar-base-pr.yml");

let tmp: string;
beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), "spec924-"));
    mkdirSync(join(tmp, "100-con-status"));
    writeFileSync(join(tmp, "100-con-status/spec.md"), "# SPEC-100 · x\n\n**Status**: IMPLEMENTADO\n");
    mkdirSync(join(tmp, "101-sin-status"));
    writeFileSync(join(tmp, "101-sin-status/spec.md"), "# SPEC-101 · x\n\nNotas sin estado.\n");
    mkdirSync(join(tmp, "102-sin-spec"));
    writeFileSync(join(tmp, "102-sin-spec/notas.md"), "x");
    mkdirSync(join(tmp, "103-inventado"));
    writeFileSync(join(tmp, "103-inventado/spec.md"), "**Status**: CASI LISTO\n");
    mkdirSync(join(tmp, "087-con-cero"));
    writeFileSync(join(tmp, "087-con-cero/spec.md"), "**Status**: FINALIZADO\n");
});
afterAll(() => rmSync(tmp, { recursive: true, force: true, maxRetries: 3 }));

describe("SPEC-924 · rama work/pi-SPEC-N exige spec.md con Status", () => {
    it("(1) control POSITIVO: rama SIN spec.md → ROJO (el hueco de SPEC-921)", () => {
        const r = verificar("work/pi-SPEC-921-build-heap", tmp);
        expect(r.aplica).toBe(true);
        expect(r.ok).toBe(false);
    });

    it("(1) carpeta sin spec.md / spec.md sin Status / Status fuera de catálogo → ROJO", () => {
        expect(verificar("work/pi-SPEC-102-x", tmp).ok).toBe(false);
        expect(verificar("work/pi-SPEC-101-x", tmp).ok).toBe(false);
        expect(verificar("work/pi-SPEC-103-x", tmp).ok).toBe(false);
    });

    it("(1) spec.md con Status canónico → VERDE (también con número con cero a la izquierda)", () => {
        expect(verificar("work/pi-SPEC-100-x", tmp).ok).toBe(true);
        expect(verificar("work/pi-SPEC-87-x", tmp).ok).toBe(true);
    });

    it("(1) ramas que no son work/pi-SPEC-N → no aplica (BI y otras no se tocan)", () => {
        for (const rama of ["work/bi-SPEC-12-x", "feature/algo", "main", ""]) {
            const r = verificar(rama, tmp);
            expect(r.aplica).toBe(false);
            expect(r.ok).toBe(true);
        }
    });

    it("(2) las ramas de los BOTS pasan contra el specs/ real", () => {
        expect(verificar("work/pi-SPEC-487-generados", SPECS_REAL).ok).toBe(true);
        expect(verificar("work/pi-SPEC-466-tension", SPECS_REAL).ok).toBe(true);
    });

    it("(3) CABLEADO: verificar_base invoca el script con la rama del PR y BLOQUEA", () => {
        const yml = readFileSync(WORKFLOW, "utf-8");
        const job = yml.slice(yml.indexOf("verificar_base:"));
        expect(job).toMatch(/node 002-2026-PROTECCION-INFANTIL\/scripts\/ci\/verificar-spec-de-rama\.mjs "\$BRANCH"/);
        expect(job).toMatch(/BRANCH: \$\{\{ github\.head_ref \}\}/);
        expect(job).toMatch(/sparse-checkout:[\s\S]*002-2026-PROTECCION-INFANTIL\/specs/);
        expect(job).not.toMatch(/continue-on-error/);
    });

    it("(4) retroactivo: 915/916/918/921 traen spec.md con Status", () => {
        for (const n of [915, 916, 918, 921]) {
            const r = verificar(`work/pi-SPEC-${n}-x`, SPECS_REAL);
            expect(r.ok, r.motivo).toBe(true);
        }
    });
});
