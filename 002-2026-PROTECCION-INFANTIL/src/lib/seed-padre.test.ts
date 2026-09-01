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
        // SPEC-339 (A-67): +2 — padre.hijos.maximo y padre.hijos.maximo_mensaje
        // (el tope de menores y su mensaje son parámetros, no constantes).
        expect(primera).toHaveLength(20);

        // Simula un valor modificado manualmente que el seed debe restablecer al default.
        await prisma.parametroSistema.update({
            where: { clave: "padre.expediente.auto_cierre_meses" },
            data: { valor: "99" },
        });

        await seedParametrosPadre();
        const segunda = await prisma.parametroSistema.findMany({
            where: { clave: { startsWith: "padre." } },
        });
        expect(segunda).toHaveLength(20);

        const restaurado = await prisma.parametroSistema.findUnique({
            where: { clave: "padre.expediente.auto_cierre_meses" },
        });
        expect(restaurado?.valor).toBe("6");
    });
});
