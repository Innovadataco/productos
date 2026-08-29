/**
 * SPEC-201: tests de NotificacionPlantillaRepository.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { NotificacionPlantillaRepository } from "./notificacion-plantilla";

describe("NotificacionPlantillaRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("upsert crea y actualiza plantilla", async () => {
        const repo = new NotificacionPlantillaRepository();
        const creada = await repo.upsert("mi.plantilla.email", {
            clave: "mi.plantilla.email",
            canal: "EMAIL",
            asunto: "Asunto",
            cuerpoMarkdown: "Cuerpo",
        });
        expect(creada.clave).toBe("mi.plantilla.email");

        const actualizada = await repo.upsert("mi.plantilla.email", {
            clave: "mi.plantilla.email",
            canal: "EMAIL",
            asunto: "Asunto nuevo",
            cuerpoMarkdown: "Cuerpo nuevo",
        });
        expect(actualizada.asunto).toBe("Asunto nuevo");
        expect(actualizada.cuerpoMarkdown).toBe("Cuerpo nuevo");
    });

    it("findByClaveYCanal recupera plantilla correcta", async () => {
        const repo = new NotificacionPlantillaRepository();
        await repo.crear({ clave: "p.email", canal: "EMAIL", cuerpoMarkdown: "Email" });
        await repo.crear({ clave: "p.in_app", canal: "IN_APP", cuerpoMarkdown: "InApp" });

        const encontrada = await repo.findByClaveYCanal("p.email", "EMAIL");
        expect(encontrada?.canal).toBe("EMAIL");
    });

    it("listarActivas excluye inactivas", async () => {
        const repo = new NotificacionPlantillaRepository();
        await repo.crear({ clave: "activa", canal: "EMAIL", cuerpoMarkdown: "x" });
        await prisma.notificacionPlantilla.create({
            data: { clave: "inactiva", canal: "EMAIL", cuerpoMarkdown: "x", activa: false },
        });

        const activas = await repo.listarActivas();
        expect(activas).toHaveLength(1);
        expect(activas[0].clave).toBe("activa");
    });
});
