/**
 * CANDADO · SPEC-903 — la guardia de disco aborta el deploy bajo el umbral y sigue por encima.
 *
 * Ejercita la función PURA `decidir_guardia_disco` (sin `df`: sourced), ambos lados del umbral y el borde.
 * Control positivo: si se invierte la comparación o se corre el umbral, los casos 14g/20g se encienden.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

const SCRIPT = path.join(process.cwd(), "scripts/guardia-disco-deploy.sh");

function decidir(libresGb: number, umbralGb: number): string {
    const cmd = `source "${SCRIPT}"; decidir_guardia_disco ${libresGb} ${umbralGb}`;
    return execFileSync("bash", ["-c", cmd], { encoding: "utf8" }).trim();
}

describe("SPEC-903 · guardia de disco pre-build", () => {
    it("14g libres < 15g umbral → ABORT (no deja llenar el disco)", () => {
        expect(decidir(14, 15)).toBe("ABORT");
    });

    it("20g libres ≥ 15g umbral → OK (sigue el deploy)", () => {
        expect(decidir(20, 15)).toBe("OK");
    });

    it("borde: libres == umbral → OK (el umbral es el mínimo aceptable, no aborta)", () => {
        expect(decidir(15, 15)).toBe("OK");
    });

    it("1g libres (disco casi lleno) → ABORT", () => {
        expect(decidir(1, 15)).toBe("ABORT");
    });

    it("el script existe y parsea (bash -n), con default de umbral embebido", () => {
        // bash -n valida sintaxis; no ejecuta df ni aborta.
        execFileSync("bash", ["-n", SCRIPT]);
        const src = execFileSync("cat", [SCRIPT], { encoding: "utf8" });
        expect(src).toMatch(/DEPLOY_MIN_DISCO_GB:-15/);
    });
});
