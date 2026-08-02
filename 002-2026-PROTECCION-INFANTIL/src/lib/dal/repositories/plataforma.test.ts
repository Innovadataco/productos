/**
 * SPEC-134 (E-1): tests del PlataformaRepository — catálogo de plataformas activas.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma } from "@/lib/reporte-test-utils";
import { PlataformaRepository } from "./plataforma";

describe("PlataformaRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("findActivas devuelve solo plataformas activas con id y nombre", async () => {
        await crearPlataforma();
        await crearPlataforma("instagram", "Instagram", "red_social");
        const telegram = await crearPlataforma("telegram", "Telegram", "mensajeria");
        await prisma.plataforma.update({ where: { id: telegram.id }, data: { esActiva: false } });
        const repo = new PlataformaRepository();

        const activas = await repo.findActivas();
        const nombres = activas.map((p) => p.nombre);
        expect(nombres, "incluye las activas sembradas").toEqual(expect.arrayContaining(["WhatsApp", "Instagram"]));
        expect(nombres, "excluye la desactivada").not.toContain("Telegram");
        expect(activas.every((p) => typeof p.id === "string" && typeof p.nombre === "string")).toBe(true);
        // Ninguna inactiva se cuela
        const idsInactivos = (await prisma.plataforma.findMany({ where: { esActiva: false }, select: { id: true } })).map((p) => p.id);
        expect(activas.some((p) => idsInactivos.includes(p.id)), "ninguna inactiva en el resultado").toBe(false);
    });
});
