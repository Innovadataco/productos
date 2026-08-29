/**
 * SPEC-201: tests de NotificacionContactoBloqueadoRepository.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { NotificacionContactoBloqueadoRepository } from "./notificacion-contacto-bloqueado";

describe("NotificacionContactoBloqueadoRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("incrementarBounce crea registro al primer bounce", async () => {
        const repo = new NotificacionContactoBloqueadoRepository();
        const registro = await repo.incrementarBounce("bounce@test.com", "hard_bounce");
        expect(registro.email).toBe("bounce@test.com");
        expect(registro.bounceCount).toBe(1);
        expect(registro.motivo).toBe("hard_bounce");
    });

    it("incrementarBounce incrementa contador", async () => {
        const repo = new NotificacionContactoBloqueadoRepository();
        await repo.incrementarBounce("bounce@test.com", "hard_bounce");
        const registro = await repo.incrementarBounce("bounce@test.com", "buzon_lleno");
        expect(registro.bounceCount).toBe(2);
    });

    it("estaBloqueado detecta email bloqueado", async () => {
        const repo = new NotificacionContactoBloqueadoRepository();
        await repo.crear("bloqueado@test.com", "complaint");
        expect(await repo.estaBloqueado("bloqueado@test.com")).toBe(true);
        expect(await repo.estaBloqueado("libre@test.com")).toBe(false);
    });

    it("marcarNotificadoAdmin registra timestamp", async () => {
        const repo = new NotificacionContactoBloqueadoRepository();
        await repo.crear("admin@test.com", "hard_bounce");
        const actualizado = await repo.marcarNotificadoAdmin("admin@test.com");
        expect(actualizado.notificadoAdminEn).not.toBeNull();
    });
});
