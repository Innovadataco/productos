/**
 * SPEC-201: tests de NotificacionReglaRepository.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { NotificacionReglaRepository } from "./notificacion-regla";

describe("NotificacionReglaRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("findByEventoActivo solo devuelve reglas activas", async () => {
        const repo = new NotificacionReglaRepository();
        await prisma.notificacionRegla.create({
            data: { evento: "e1", rol: "PADRE", offset: "+0m", canal: "EMAIL", plantillaClave: "p.email", activa: true },
        });
        await prisma.notificacionRegla.create({
            data: { evento: "e1", rol: "PADRE", offset: "+0m", canal: "IN_APP", plantillaClave: "p.in_app", activa: false },
        });

        const activas = await repo.findByEventoActivo("e1");
        expect(activas).toHaveLength(1);
        expect(activas[0].canal).toBe("EMAIL");
    });

    it("findByEventoRolCanal recupera la regla más reciente", async () => {
        const repo = new NotificacionReglaRepository();
        await prisma.notificacionRegla.create({
            data: { evento: "e1", rol: "PADRE", offset: "+0m", canal: "EMAIL", plantillaClave: "old", activa: true },
        });
        const nueva = await prisma.notificacionRegla.create({
            data: { evento: "e1", rol: "PADRE", offset: "+0m", canal: "EMAIL", plantillaClave: "new", activa: true },
        });

        const encontrada = await repo.findByEventoRolCanal("e1", "PADRE", "EMAIL");
        expect(encontrada?.id).toBe(nueva.id);
    });

    it("actualizar modifica offset y plantilla", async () => {
        const repo = new NotificacionReglaRepository();
        const regla = await prisma.notificacionRegla.create({
            data: { evento: "e1", rol: "PADRE", offset: "+0m", canal: "EMAIL", plantillaClave: "old" },
        });
        const actualizada = await repo.actualizar(regla.id, { offset: "-1d", plantillaClave: "new" });
        expect(actualizada.offset).toBe("-1d");
        expect(actualizada.plantillaClave).toBe("new");
    });
});
