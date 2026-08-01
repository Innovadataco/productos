/**
 * S-1 (002-PI-052): ANTI_ABUSO_SALT es obligatorio y sin fallback.
 * El módulo truena al importarse sin la variable (requireEnv al arrancar).
 */
import { describe, it, expect, vi } from "vitest";

describe("salt anti-abuso (S-1)", () => {
    it("el módulo se importa con la variable configurada (entorno de test)", async () => {
        const modulo = await import("./fuente-reporte");
        expect(modulo.getFuentePesoParams).toBeDefined();
    });

    it("sin ANTI_ABUSO_SALT el módulo TRUENA al importar (sin fallback)", async () => {
        const original = process.env.ANTI_ABUSO_SALT;
        delete process.env.ANTI_ABUSO_SALT;
        vi.resetModules();
        try {
            await expect(import("./fuente-reporte")).rejects.toThrow(/ANTI_ABUSO_SALT/);
        } finally {
            process.env.ANTI_ABUSO_SALT = original;
            vi.resetModules();
        }
    });

    it("un salt corto (< 32 chars) también truena", async () => {
        const original = process.env.ANTI_ABUSO_SALT;
        process.env.ANTI_ABUSO_SALT = "corto";
        vi.resetModules();
        try {
            await expect(import("./fuente-reporte")).rejects.toThrow(/ANTI_ABUSO_SALT/);
        } finally {
            process.env.ANTI_ABUSO_SALT = original;
            vi.resetModules();
        }
    });
});
