import { describe, it, expect } from "vitest";
import { buscarInfractores, PATRON_SPY, PATRON_MOCK } from "./no-prisma-mocks";

/**
 * SPEC-174: la regla anti-mocks de Prisma (sección (e) de arch:check).
 * Los positivos se prueban contra strings sintéticos — un fixture real en src/
 * sería flaggeado por la propia regla.
 */
describe("no-prisma-mocks (SPEC-174, sección (e))", () => {
    it("el árbol real de integration no tiene infractores fuera de la allowlist", () => {
        expect(buscarInfractores()).toEqual([]);
    });

    it("PATRON_SPY detecta vi.spyOn sobre el singleton y no otros spyOn", () => {
        expect(PATRON_SPY.test('vi.spyOn(prisma, "$queryRaw")')).toBe(true);
        expect(PATRON_SPY.test('vi.spyOn(prisma.parametroSistema, "findUnique")')).toBe(true);
        expect(PATRON_SPY.test("vi.spyOn(\n    prisma,\n    \"findMany\"\n)")).toBe(true);
        expect(PATRON_SPY.test('vi.spyOn(auth, "verifyAuth")')).toBe(false);
        expect(PATRON_SPY.test('vi.spyOn(prismaFake, "findUnique")')).toBe(false);
    });

    it("PATRON_MOCK detecta vi.mock del módulo prisma en sus formas y no otros módulos", () => {
        expect(PATRON_MOCK.test('vi.mock("@/lib/prisma", () => ({})')).toBe(true);
        expect(PATRON_MOCK.test('vi.mock("./prisma", () => ({})')).toBe(true);
        expect(PATRON_MOCK.test('vi.mock("../prisma")')).toBe(true);
        expect(PATRON_MOCK.test('vi.mock("../../lib/prisma", async () => ({}))')).toBe(true);
        expect(PATRON_MOCK.test('vi.mock("@/lib/parametros")')).toBe(false);
        expect(PATRON_MOCK.test('vi.mock("@/lib/email")')).toBe(false);
        expect(PATRON_MOCK.test('vi.mock("next/navigation")')).toBe(false);
    });
});
