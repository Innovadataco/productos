/**
 * SPEC-234 (002-PI-134): test de idempotencia del seed de señal comunitaria.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { seedParametrosSenalComunitaria } from "../../prisma/seed";

describe("seedParametrosSenalComunitaria", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("es idempotente y propaga cambios de default", async () => {
        await seedParametrosSenalComunitaria();
        const primera = await prisma.parametroSistema.findUnique({
            where: { clave: "padre.senal_comunitaria.refresh_min" },
        });
        expect(primera?.valor).toBe("60");

        await prisma.parametroSistema.update({
            where: { clave: "padre.senal_comunitaria.refresh_min" },
            data: { valor: "999" },
        });

        await seedParametrosSenalComunitaria();
        const segunda = await prisma.parametroSistema.findUnique({
            where: { clave: "padre.senal_comunitaria.refresh_min" },
        });
        expect(segunda?.valor).toBe("60");

        const total = await prisma.parametroSistema.count({
            where: { clave: "padre.senal_comunitaria.refresh_min" },
        });
        expect(total).toBe(1);
    });
});
