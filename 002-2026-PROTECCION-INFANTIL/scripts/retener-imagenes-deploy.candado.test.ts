/**
 * CANDADO · SPEC-903 — la retención de imágenes conserva la corriente/latest y borra las viejas.
 *
 * Ejercita la función PURA `seleccionar_a_borrar` del script de retención (sin docker: se la invoca por
 * `source` + stdin), con una lista simulada de N+k imágenes. Verifica que con N=1 queda EXACTAMENTE la más
 * nueva (= corriente/latest), se borran TODAS las anteriores, y que un ID PROTEGIDO (corriendo/latest/
 * desplegado) jamás sale aunque sea viejo. Más el guard fail-safe: un flag no reconocido ABORTA sin borrar.
 *
 * Control positivo: si se rompe la protección o el conteo N, los `toEqual`/`not.toContain` se encienden.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

const SCRIPT = path.join(process.cwd(), "scripts/retener-imagenes-deploy.sh");

/** Invoca la función pura `seleccionar_a_borrar` del script (sourced, sin ejecutar main / sin docker). */
function seleccionar(keepN: number, protegidos: string[], idsNuevoPrimero: string[]): string[] {
    const idsArgs = idsNuevoPrimero.map((s) => `'${s}'`).join(" ");
    const cmd = `source "${SCRIPT}"; printf '%s\\n' ${idsArgs} | seleccionar_a_borrar ${keepN} '${protegidos.join(" ")}'`;
    const out = execFileSync("bash", ["-c", cmd], { encoding: "utf8" });
    return out.split("\n").map((s) => s.trim()).filter(Boolean);
}

describe("SPEC-903 · retención de imágenes del deploy (N=1)", () => {
    it("N=1: conserva SOLO la más nueva (= corriente/latest) y borra TODAS las anteriores", () => {
        const borrar = seleccionar(1, ["sha-new"], ["sha-new", "sha-3", "sha-2", "sha-1"]);
        expect(borrar).toEqual(["sha-3", "sha-2", "sha-1"]);
    });

    it("el ID PROTEGIDO (corriendo/latest) jamás sale, aunque sea viejo", () => {
        // sha-old es la que respalda al contenedor corriendo pero quedó vieja; N=1 conserva la más nueva Y la protegida.
        const borrar = seleccionar(1, ["sha-old"], ["sha-new", "sha-mid", "sha-old"]);
        expect(borrar).toEqual(["sha-mid"]);
        expect(borrar).not.toContain("sha-old");
        expect(borrar).not.toContain("sha-new");
    });

    it("una sola imagen → no borra nada", () => {
        expect(seleccionar(1, ["sha-new"], ["sha-new"])).toEqual([]);
    });

    it("varios protegidos (latest + cada contenedor corriendo) se conservan todos", () => {
        const borrar = seleccionar(1, ["sha-new", "sha-run"], ["sha-new", "sha-x", "sha-run", "sha-y"]);
        expect(borrar).toEqual(["sha-x", "sha-y"]);
        expect(borrar).not.toContain("sha-run");
    });

    it("flag no reconocido ABORTA fail-safe (exit 2, antes de tocar docker)", () => {
        let code = 0;
        try {
            execFileSync("bash", [SCRIPT, "--borra-todo"], { encoding: "utf8", stdio: "pipe" });
        } catch (e: unknown) {
            code = (e as { status?: number }).status ?? -1;
        }
        expect(code).toBe(2);
    });
});
