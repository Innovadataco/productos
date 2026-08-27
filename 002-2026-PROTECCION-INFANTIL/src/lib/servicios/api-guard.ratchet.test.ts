/**
 * SPEC-291 (002-PI-191) — Ratchet estático:
 * cada `route.ts` bajo `src/app/api/admin/servicios/` que exporta POST DEBE
 *   1. importar/usar `assertModulo(..., "sistema_admin")`
 *   2. llamar `logAudit(...)`
 *
 * También el endpoint GET /estado debe usar `assertModulo("sistema_admin")`.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const RAIZ = path.join(REPO_ROOT, "src/app/api/admin/servicios");

function listarRouteTs(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listarRouteTs(full));
        else if (entry.name === "route.ts") out.push(full);
    }
    return out;
}

describe("SPEC-291 · ratchet endpoints-servicios-restringidos", () => {
    const rutas = listarRouteTs(RAIZ);

    it("hay al menos 4 route.ts en /api/admin/servicios/ (sanidad)", () => {
        expect(rutas.length).toBeGreaterThanOrEqual(4);
    });

    it("todo endpoint POST llama assertModulo('sistema_admin') y logAudit", () => {
        const violaciones: string[] = [];
        for (const ruta of rutas) {
            const src = fs.readFileSync(ruta, "utf8");
            const tienePost = /export\s+async\s+function\s+POST\b/.test(src);
            if (!tienePost) continue;
            // Los POST delegan en handlerAccionServicio; el handler debe cumplir ambos ratchets.
            // Verificación transitiva: importar `handlerAccionServicio` cuenta como delegación válida.
            const delega = /handlerAccionServicio/.test(src);
            const propio =
                /assertModulo\([^)]*sistema_admin/.test(src) && /logAudit\s*\(/.test(src);
            if (!delega && !propio) {
                violaciones.push(`${ruta}: POST sin assertModulo(sistema_admin)+logAudit (ni delega en handlerAccionServicio)`);
            }
        }
        expect(violaciones, violaciones.join(" · ")).toEqual([]);
    });

    it("todo endpoint GET llama assertModulo('sistema_admin')", () => {
        const violaciones: string[] = [];
        for (const ruta of rutas) {
            const src = fs.readFileSync(ruta, "utf8");
            const tieneGet = /export\s+async\s+function\s+GET\b/.test(src);
            if (!tieneGet) continue;
            if (!/assertModulo\([^)]*sistema_admin/.test(src)) {
                violaciones.push(`${ruta}: GET sin assertModulo(sistema_admin)`);
            }
        }
        expect(violaciones, violaciones.join(" · ")).toEqual([]);
    });

    it("el handler compartido src/lib/servicios/api-accion.ts implementa los 2 ratchets", () => {
        const ruta = path.join(REPO_ROOT, "src/lib/servicios/api-accion.ts");
        const src = fs.readFileSync(ruta, "utf8");
        expect(src).toMatch(/assertModulo\([^)]*sistema_admin/);
        expect(src).toMatch(/logAudit\s*\(/);
        expect(src).toMatch(/x-confirm-action/i);
    });
});
