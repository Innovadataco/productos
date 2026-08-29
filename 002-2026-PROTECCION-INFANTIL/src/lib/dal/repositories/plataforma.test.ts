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

    it("E-8: listarActivasConCategoria incluye clave y categoría (el orden 'otro al final' es de la ruta)", async () => {
        await crearPlataforma();
        await crearPlataforma("otro", "Otra", "otro");
        const telegram = await crearPlataforma("telegram", "Telegram", "mensajeria");
        await prisma.plataforma.update({ where: { id: telegram.id }, data: { esActiva: false } });
        const repo = new PlataformaRepository();

        const lista = await repo.listarActivasConCategoria();
        const claves = lista.map((p) => p.clave);
        expect(claves).toContain("whatsapp");
        expect(claves).toContain("otro");
        expect(claves).not.toContain("telegram");
        expect(lista.every((p) => typeof p.categoria === "string")).toBe(true);
        expect(lista.map((p) => p.nombre)).toEqual([...lista.map((p) => p.nombre)].sort());
    });
});
