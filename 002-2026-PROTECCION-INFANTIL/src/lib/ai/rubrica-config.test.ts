import { describe, it, expect, beforeEach, vi } from "vitest";
import { cargarConfigRubrica } from "./rubrica";

const mockParametroFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
    prisma: {
        parametroSistema: {
            findUnique: (...args: unknown[]) => mockParametroFindUnique(...args),
        },
    },
}));

describe("cargarConfigRubrica — default seguro D-19 (spec 095-US1)", () => {
    beforeEach(() => {
        mockParametroFindUnique.mockReset();
    });

    it("sin parámetro (seed limpio sin la clave) → legacy por defecto (enabled=false)", async () => {
        mockParametroFindUnique.mockResolvedValue(null);
        const cfg = await cargarConfigRubrica();
        expect(cfg.enabled).toBe(false);
    });

    it("parámetro 'false' (valor del seed D-19) → legacy por defecto", async () => {
        mockParametroFindUnique.mockImplementation((args: { where: { clave: string } }) =>
            Promise.resolve(args.where.clave === "ia.rubrica.enabled" ? { valor: "false" } : null)
        );
        const cfg = await cargarConfigRubrica();
        expect(cfg.enabled).toBe(false);
    });

    it("parámetro 'true' explícito → la rúbrica se activa (sigue en desarrollo, no borrada)", async () => {
        mockParametroFindUnique.mockImplementation((args: { where: { clave: string } }) =>
            Promise.resolve(args.where.clave === "ia.rubrica.enabled" ? { valor: "true" } : null)
        );
        const cfg = await cargarConfigRubrica();
        expect(cfg.enabled).toBe(true);
    });
});
