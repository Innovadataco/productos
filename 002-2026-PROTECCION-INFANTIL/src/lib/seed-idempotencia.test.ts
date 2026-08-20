/**
 * SPEC-187 (002-PI-082) · Bloque G · I-69
 * Verifica funcionalmente que re-correr el seed no pise los valores custom
 * que el CEO haya ajustado a mano en parámetros "viejos".
 */
import { describe, it, expect, beforeEach } from "vitest";
import { main } from "../../prisma/seed";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";

describe("seed idempotencia — no pisa valores custom (SPEC-187)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("re-seed respeta monitoreo.enabled=false ajustado manualmente", async () => {
        // Primera corrida crea los parámetros por defecto.
        await main();

        // CEO apaga el vigilante manualmente (caso real de I-69).
        await prisma.parametroSistema.update({
            where: { clave: "monitoreo.enabled" },
            data: { valor: "false" },
        });

        // Segunda corrida NO debe volver a enabled=true.
        await main();

        const param = await prisma.parametroSistema.findUnique({
            where: { clave: "monitoreo.enabled" },
        });
        expect(param?.valor).toBe("false");
    });

    it("re-seed respeta monitoreo.ollama.smoke.modelo ya configurado", async () => {
        await main();

        await prisma.parametroSistema.update({
            where: { clave: "monitoreo.ollama.smoke.modelo" },
            data: { valor: "llama-guard3:8b" },
        });

        await main();

        const param = await prisma.parametroSistema.findUnique({
            where: { clave: "monitoreo.ollama.smoke.modelo" },
        });
        expect(param?.valor).toBe("llama-guard3:8b");
    });

    it("re-seed sigue aplicando defaults de parámetros nuevos/cambiados (SPEC-186)", async () => {
        await main();

        // Alguien cambia el intervalo a 5 min (valor anterior a SPEC-186).
        await prisma.parametroSistema.update({
            where: { clave: "monitoreo.ollama.smoke.intervalo_min" },
            data: { valor: "5" },
        });

        await main();

        // monitoreoNuevos usa update con valor → debe volver a 30.
        const param = await prisma.parametroSistema.findUnique({
            where: { clave: "monitoreo.ollama.smoke.intervalo_min" },
        });
        expect(param?.valor).toBe("30");
    });
});
