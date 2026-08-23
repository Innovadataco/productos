/**
 * SPEC-190 (002-PI-085) · I-67
 * Simula el escenario de deploy: el seed corre idempotentemente en producción,
 * respeta valores custom del CEO y aplica defaults de parámetros nuevos/cambiados.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { main } from "../../prisma/seed";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";

describe("deploy seed idempotente (SPEC-190)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("primer deploy crea parámetros y segundo deploy respeta valores custom", async () => {
        // Primer deploy: seed corre desde cero.
        await main();

        // CEO ajusta valores manualmente en producción (casos reales de I-69/I-67).
        await prisma.parametroSistema.update({
            where: { clave: "monitoreo.enabled" },
            data: { valor: "false" },
        });
        await prisma.parametroSistema.update({
            where: { clave: "monitoreo.ollama.smoke.modelo" },
            data: { valor: "llama-guard3:8b" },
        });

        // Segundo deploy: el seed vuelve a correr.
        await main();

        // Valores custom se conservan (DO NOTHING en parámetros viejos).
        const enabled = await prisma.parametroSistema.findUnique({
            where: { clave: "monitoreo.enabled" },
        });
        const modelo = await prisma.parametroSistema.findUnique({
            where: { clave: "monitoreo.ollama.smoke.modelo" },
        });
        expect(enabled?.valor).toBe("false");
        expect(modelo?.valor).toBe("llama-guard3:8b");

        // Parámetro cuyo default cambió por SPEC-186 se reaplica (DO UPDATE).
        const intervalo = await prisma.parametroSistema.findUnique({
            where: { clave: "monitoreo.ollama.smoke.intervalo_min" },
        });
        expect(intervalo?.valor).toBe("30");
    });

    it("deploy posterior crea un parámetro que falta sin pisar el resto", async () => {
        await main();

        // Simula un parámetro nuevo que aún no existe en producción.
        await prisma.parametroSistema.delete({
            where: { clave: "operadores.reconciliacion_enabled" },
        });

        const antes = await prisma.parametroSistema.findUnique({
            where: { clave: "operadores.reconciliacion_enabled" },
        });
        expect(antes).toBeNull();

        // Corre el seed (deploy).
        await main();

        const despues = await prisma.parametroSistema.findUnique({
            where: { clave: "operadores.reconciliacion_enabled" },
        });
        expect(despues?.valor).toBe("true");
    });
});
