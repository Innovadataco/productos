import { describe, it, expect, vi } from "vitest";
import { prisma } from "./prisma";

let originalFindUnique: typeof prisma.parametroSistema.findUnique;

describe("restorePrismaMethods (I-54)", () => {
    it("permite espiar parametroSistema.findUnique sin romper tests siguientes", () => {
        originalFindUnique = prisma.parametroSistema.findUnique;
        vi.spyOn(prisma.parametroSistema, "findUnique").mockResolvedValue(null);
        expect(prisma.parametroSistema.findUnique).not.toBe(originalFindUnique);
        // No llamamos a vi.restoreAllMocks(): el afterEach compartido debe restaurar
        // el método original copiándolo desde el snapshot real.
    });

    it("restaura el método original de parametroSistema.findUnique tras el spy", () => {
        expect(prisma.parametroSistema.findUnique).toBe(originalFindUnique);
    });
});
