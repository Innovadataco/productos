import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { verificarVigenciaColegio, normalizarFechaServicio } from "./vigencia";

describe("src/lib/colegio/vigencia", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("colegio con inicio hoy está vigente", async () => {
        const { admin } = await crearColegioConAdmin();
        await prisma.colegio.update({
            where: { id: admin.colegioId! },
            data: { inicioServicio: normalizarFechaServicio(new Date()) },
        });

        const result = await verificarVigenciaColegio(admin.id);
        expect(result.vigente).toBe(true);
        expect(result.estado).toBe("vigente");
    });

    it("colegio con inicio mañana está no_iniciado", async () => {
        const { admin } = await crearColegioConAdmin();
        const maniana = new Date();
        maniana.setDate(maniana.getDate() + 1);
        await prisma.colegio.update({
            where: { id: admin.colegioId! },
            data: { inicioServicio: normalizarFechaServicio(maniana) },
        });

        const result = await verificarVigenciaColegio(admin.id);
        expect(result.vigente).toBe(false);
        expect(result.estado).toBe("no_iniciado");
    });

    it("colegio con fin ayer está vencido", async () => {
        const { admin } = await crearColegioConAdmin();
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        await prisma.colegio.update({
            where: { id: admin.colegioId! },
            data: { finServicio: normalizarFechaServicio(ayer) },
        });

        const result = await verificarVigenciaColegio(admin.id);
        expect(result.vigente).toBe(false);
        expect(result.estado).toBe("vencido");
    });

    it("colegio con fin hoy está vigente", async () => {
        const { admin } = await crearColegioConAdmin();
        await prisma.colegio.update({
            where: { id: admin.colegioId! },
            data: { finServicio: normalizarFechaServicio(new Date()) },
        });

        const result = await verificarVigenciaColegio(admin.id);
        expect(result.vigente).toBe(true);
        expect(result.estado).toBe("vigente");
    });
});
