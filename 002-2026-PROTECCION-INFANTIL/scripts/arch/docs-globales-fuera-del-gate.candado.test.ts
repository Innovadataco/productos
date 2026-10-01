/**
 * CANDADO · SPEC-803 — las fotos del estado GLOBAL (00/01/06) salen del gate byte-exacto del PR.
 *
 * El gate del PR pasa a verificar SOLO REPRESENTABILIDAD (que el generador corra), no
 * `committed == regen`; el barrido post-merge las regenera sobre `main` y detecta el drift. Así un
 * PR de schema en ráfaga no deja `main` rojo ni obliga a rebasar a todos.
 *
 * Candado #1 del radicado (el que puede salir mal): el aparato NO se quita. Este candado afirma que
 * `verificarDrift` SIGUE corriendo el generador (representabilidad) ANTES de cualquier salto — si
 * alguien hace que el flag salte también el generador, el gate quedaría ciego y este candado cae.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { ARTEFACTOS } from "./artefactos";

const AQUI = dirname(fileURLToPath(import.meta.url)); // …/scripts/arch
const REPO_ROOT = resolve(AQUI, "../../..");
const WORKFLOW = resolve(REPO_ROOT, ".github/workflows/generados-post-merge.yml");
const ARCH_CHECK = resolve(AQUI, "arch-check.ts");

const GLOBALES = ["00-INDICE.md", "01-modelo-datos.md", "06-stack.md"];

describe("SPEC-803 · 00/01/06 fuera del gate byte-exacto del PR", () => {
    it("los tres docs globales están marcados `fueraDelGatePorPR`", () => {
        for (const archivo of GLOBALES) {
            const a = ARTEFACTOS.find((x) => x.archivo === archivo);
            expect(a, `${archivo} no está en ARTEFACTOS`).toBeTruthy();
            expect(a!.fueraDelGatePorPR, `${archivo} debe salir del gate byte-exacto (SPEC-803)`).toBe(true);
        }
    });

    it("el barrido post-merge REGENERA y COMMITEA los tres (se mantienen al día sobre main)", () => {
        const yml = readFileSync(WORKFLOW, "utf8");
        // regenera cada uno
        expect(yml).toMatch(/generar-indice\.ts/);
        expect(yml).toMatch(/generar-modelo-datos\.ts/);
        expect(yml).toMatch(/generar-stack\.ts/);
        // y los incluye en los ARCHIVOS que detecta/commitea
        for (const archivo of GLOBALES) {
            expect(yml, `${archivo} no está en los ARCHIVOS del post-merge`).toContain(`docs/architecture/${archivo}`);
        }
    });

    it("candado #1: el gate NO se quita — `verificarDrift` corre el generador ANTES del salto", () => {
        const src = readFileSync(ARCH_CHECK, "utf8");
        const iGenerar = src.indexOf("await generar()");
        const iSalto = src.indexOf("fueraDelGatePorPR) continue");
        expect(iGenerar, "verificarDrift ya no invoca el generador (representabilidad perdida)").toBeGreaterThan(0);
        expect(iSalto, "el salto por fueraDelGatePorPR desapareció").toBeGreaterThan(0);
        // el generador (representabilidad) corre ANTES de saltar el byte-exacto: el aparato sigue vivo.
        expect(iGenerar, "el salto ocurre antes de correr el generador → el gate quedaría ciego").toBeLessThan(iSalto);
    });
});
