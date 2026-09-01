/**
 * SPEC-344 (A-69 · C1 · Puente D2, R6) — el paso Plan del camino ESCRIBE
 * `Colegio.finServicio` (cierra "gratis para siempre"). Auditoría #222 · punto 4:
 * este test estaba comprometido en el instructivo y faltaba.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { actualizarFinServicioDesdePlan, calcularFinDesdeDuracionPlan } from "./vigencia-colegio.service";

const DIA_MS = 24 * 60 * 60 * 1000;

describe("vigencia-colegio.service (puente D2)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("freemium escribe Colegio.finServicio = hoy + 30 días (default parametrizable)", async () => {
        const { colegio } = await crearColegioConAdmin();
        const antes = Date.now();

        const fin = await actualizarFinServicioDesdePlan(colegio.id, { tipo: "freemium" });

        const enBd = await prisma.colegio.findUniqueOrThrow({ where: { id: colegio.id } });
        expect(enBd.finServicio?.getTime(), "lo devuelto es lo persistido").toBe(fin.getTime());
        // Ventana de 30 días (default del parámetro), con tolerancia de ejecución.
        const esperado = antes + 30 * DIA_MS;
        expect(Math.abs(fin.getTime() - esperado)).toBeLessThan(60_000);
    });

    it("freemium respeta pagos.freemium.duracion_dias parametrizado", async () => {
        const { colegio } = await crearColegioConAdmin();
        await prisma.parametroSistema.upsert({
            where: { clave: "pagos.freemium.duracion_dias" },
            update: { valor: "7" },
            create: { clave: "pagos.freemium.duracion_dias", valor: "7", tipo: "INTEGER", categoria: "SYSTEM", descripcion: "test" },
        });

        const fin = await actualizarFinServicioDesdePlan(colegio.id, { tipo: "freemium" });
        expect(Math.abs(fin.getTime() - (Date.now() + 7 * DIA_MS))).toBeLessThan(60_000);
    });

    it("pagado escribe finServicio según la duración del plan y pisa el valor anterior", async () => {
        const { colegio } = await crearColegioConAdmin();
        await actualizarFinServicioDesdePlan(colegio.id, { tipo: "freemium" });

        const fin = await actualizarFinServicioDesdePlan(colegio.id, { tipo: "pagado", duracion: "MES_12" });
        const enBd = await prisma.colegio.findUniqueOrThrow({ where: { id: colegio.id } });
        expect(enBd.finServicio?.getTime()).toBe(fin.getTime());
        // Un año adelante (paridad con calcularFinDesdeDuracionPlan, wiring no tautológico:
        // se contrasta contra la ventana en días, no contra la misma función).
        const dias = (fin.getTime() - Date.now()) / DIA_MS;
        expect(dias).toBeGreaterThan(360);
        expect(dias).toBeLessThan(371);
    });

    it("calcularFinDesdeDuracionPlan: MES_2/MES_3 caen a meses aditivos", () => {
        const inicio = new Date("2026-01-15T10:00:00Z");
        expect(calcularFinDesdeDuracionPlan(inicio, "MES_2").getUTCMonth()).toBe(2); // marzo
        expect(calcularFinDesdeDuracionPlan(inicio, "MES_3").getUTCMonth()).toBe(3); // abril
    });
});
