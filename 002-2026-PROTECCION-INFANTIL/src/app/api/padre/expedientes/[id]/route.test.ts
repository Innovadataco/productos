/**
 * SPEC-340 (auditoría #208 · candado texto propio con step-up):
 * la ruta antigua GET /api/padre/expedientes/[id] fue BORRADA porque devolvía
 * el blob "enc:" y el texto descifrado sin step-up. Este test blinda la baja:
 * si alguien recrea el módulo, no exportará GET y Next devolverá 405 (o 404 al
 * runtime); acá lo verificamos por la ausencia del módulo mismo.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("SPEC-340 · ruta GET /api/padre/expedientes/[id] eliminada", () => {
    it("el archivo route.ts NO existe (el texto propio solo por step-up)", () => {
        const ruta = join(process.cwd(), "src/app/api/padre/expedientes/[id]/route.ts");
        expect(existsSync(ruta), "la ruta vieja debe permanecer borrada — el texto propio va por /api/padre/reportes/[id]/texto con step-up").toBe(false);
    });
});
