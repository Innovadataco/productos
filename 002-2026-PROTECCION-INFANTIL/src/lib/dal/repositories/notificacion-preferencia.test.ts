/**
 * SPEC-201: tests de NotificacionPreferenciaRepository.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { NotificacionPreferenciaRepository } from "./notificacion-preferencia";

describe("NotificacionPreferenciaRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("estaHabilitada devuelve true por defecto", async () => {
        const repo = new NotificacionPreferenciaRepository();
        const habilitada = await repo.estaHabilitada("user-1", "evento.email", false);
        expect(habilitada).toBe(true);
    });

    it("estaHabilitada respeta preferencia deshabilitada", async () => {
        const repo = new NotificacionPreferenciaRepository();
        await repo.actualizar("user-1", "evento.email", false);
        const habilitada = await repo.estaHabilitada("user-1", "evento.email", false);
        expect(habilitada).toBe(false);
    });

    it("estaHabilitada ignora preferencia si es obligatoria", async () => {
        const repo = new NotificacionPreferenciaRepository();
        await repo.actualizar("user-1", "evento.email", false);
        const habilitada = await repo.estaHabilitada("user-1", "evento.email", true);
        expect(habilitada).toBe(true);
    });

    it("actualizar hace upsert", async () => {
        const repo = new NotificacionPreferenciaRepository();
        await repo.actualizar("user-1", "evento.email", false);
        await repo.actualizar("user-1", "evento.email", true);
        const pref = await repo.findByUsuarioYEvento("user-1", "evento.email");
        expect(pref?.habilitado).toBe(true);
    });
});
