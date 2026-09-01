/**
 * SPEC-230 (002-PI-130): test de idempotencia del seed de parámetros padre.*
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { seedParametrosPadre } from "../../prisma/seed";

describe("seedParametrosPadre", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("no duplica filas y propaga cambios de default definidos en código", async () => {
        await seedParametrosPadre();
        const primera = await prisma.parametroSistema.findMany({
            where: { clave: { startsWith: "padre." } },
        });
        // Conteo contra el propio seed (no un número mágico que se desactualiza
        // con cada spec que suma parámetros): lo que importa es la IDEMPOTENCIA
        // — el segundo run no duplica — y que haya un mínimo razonable.
        const conteoInicial = primera.length;
        expect(conteoInicial).toBeGreaterThanOrEqual(20);

        // Simula un valor modificado manualmente que el seed debe restablecer al default.
        await prisma.parametroSistema.update({
            where: { clave: "padre.expediente.auto_cierre_meses" },
            data: { valor: "99" },
        });

        await seedParametrosPadre();
        const segunda = await prisma.parametroSistema.findMany({
            where: { clave: { startsWith: "padre." } },
        });
        expect(segunda, "idempotente: el 2º run no duplica filas").toHaveLength(conteoInicial);

        const restaurado = await prisma.parametroSistema.findUnique({
            where: { clave: "padre.expediente.auto_cierre_meses" },
        });
        // SPEC-340 (D-1): el auto-cierre quedó DEROGADO — el default es 0.
        expect(restaurado?.valor).toBe("0");
    });
});
