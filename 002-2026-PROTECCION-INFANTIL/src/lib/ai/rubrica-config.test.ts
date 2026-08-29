import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";
import { unmockPrisma } from "@/lib/test-mocks/unmock-prisma";
import { cargarConfigRubrica } from "./rubrica";

const mockParametroFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
    prisma: {
        parametroSistema: {
            findUnique: (...args: unknown[]) => mockParametroFindUnique(...args),
        },
    },
}));

afterAll(async () => await unmockPrisma());

describe("cargarConfigRubrica — defaults de la semilla", () => {
    beforeEach(() => {
        mockParametroFindUnique.mockReset();
    });

    it("sin parámetros usa defaults de la semilla", async () => {
        mockParametroFindUnique.mockResolvedValue(null);
        const cfg = await cargarConfigRubrica();
        expect(cfg.modelos).toEqual(["gemma2:27b", "qwen2.5:14b", "aya-expanse:32b"]);
        expect(cfg.temperatura).toBe(0.2);
        expect(cfg.umbralPresencia).toBe(0.6);
        expect(cfg.modeloEmbudo).toBe("qwen2.5:14b");
    });

    it("lee modelos, temperatura y umbral desde ParametroSistema", async () => {
        mockParametroFindUnique.mockImplementation((args: { where: { clave: string } }) => {
            const map: Record<string, { valor: string }> = {
                "ia.rubrica.modelos": { valor: JSON.stringify(["m1", "m2"]) },
                "ia.rubrica.temperatura": { valor: "0.5" },
                "ia.rubrica.umbral_presencia": { valor: "0.8" },
                "ia.rubrica.modelo_embudo": { valor: "embudo:7b" },
            };
            return Promise.resolve(map[args.where.clave] ?? null);
        });
        const cfg = await cargarConfigRubrica();
        expect(cfg.modelos).toEqual(["m1", "m2"]);
        expect(cfg.temperatura).toBe(0.5);
        expect(cfg.umbralPresencia).toBe(0.8);
        expect(cfg.modeloEmbudo).toBe("embudo:7b");
    });
});
