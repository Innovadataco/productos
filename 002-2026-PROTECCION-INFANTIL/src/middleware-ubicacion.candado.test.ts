/**
 * SPEC-600 — CANDADO: el middleware vive donde Next.js lo busca.
 *
 * Bug crítico en producción (VPS): con App Router en `src/`, Next SOLO
 * autodetecta `src/middleware.ts`. La implementación vive en la raíz
 * (`middleware.ts`, SPEC-287/588) y los tests la importan de ahí — así que la
 * suite pasaba mientras en producción `.next/server/middleware.js` nunca se
 * generaba y TODA la capa de routing (guard de sesión, auth-screens, CSP)
 * nunca corría. Este candado frena la recaída: `src/middleware.ts` debe
 * existir, re-exportar `middleware` + `config`, y ser la MISMA referencia que
 * la raíz (un re-export, no una copia).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("SPEC-600 · candado: src/middleware.ts es el punto que Next autodetecta", () => {
    it("src/middleware.ts existe y re-exporta la implementación de la raíz", () => {
        const ruta = path.resolve(__dirname, "middleware.ts");
        expect(fs.existsSync(ruta)).toBe(true);
        const fuente = fs.readFileSync(ruta, "utf-8");
        expect(fuente).toContain('export { middleware } from "../middleware"');
    });

    it("re-exporta middleware (función) y declara config con matcher no vacío", async () => {
        const mod = await import("./middleware");
        expect(typeof mod.middleware).toBe("function");
        expect(typeof mod.config).toBe("object");
        expect(mod.config).not.toBeNull();
        expect(Array.isArray(mod.config.matcher)).toBe(true);
        expect(mod.config.matcher.length).toBeGreaterThan(0);
    });

    it("middleware es la MISMA referencia que la raíz y el matcher es idéntico (cero deriva)", async () => {
        const raiz = await import("../middleware");
        const src = await import("./middleware");
        expect(src.middleware).toBe(raiz.middleware);
        expect(src.config.matcher).toEqual(raiz.config.matcher);
    });
});
