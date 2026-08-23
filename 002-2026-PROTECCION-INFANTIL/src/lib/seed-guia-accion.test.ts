import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "./prisma";
import { resetDatabase } from "./test-utils";
import { seedGuiasAccion } from "../../prisma/seed";
import { crearUsuario } from "./reporte-test-utils";

describe("seedGuiasAccion", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("crea 8 guías v1 y respeta valores custom en re-ejecuciones", async () => {
        const admin = await crearUsuario("ADMIN", "admin@seed.local");
        await seedGuiasAccion("admin@seed.local");
        const creadas = await prisma.guiaAccionCategoria.count({ where: { estado: "ACTIVA" } });
        expect(creadas).toBe(8);

        await prisma.guiaAccionCategoria.updateMany({
            where: { categoria: "GROOMING" },
            data: { estado: "BORRADOR" },
        });

        await seedGuiasAccion("admin@seed.local");
        const grooming = await prisma.guiaAccionCategoria.findFirst({
            where: { categoria: "GROOMING" },
        });
        expect(grooming?.estado).toBe("BORRADOR");
        const total = await prisma.guiaAccionCategoria.count();
        expect(total).toBe(8);
    });
});
