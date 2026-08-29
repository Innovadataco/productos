/**
 * SPEC-302 (002-PI-208 · R-022 §1.3 punto a): test de integración de la
 * métrica de notificaciones ENCOLADA vencidas (patrón I-147).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { contarPendientesVencidas } from "./metricas";

async function crearNotificacion(estado: "ENCOLADA" | "ENVIADA", enviarEn: Date, evento = "test.evento") {
    return prisma.notificacion.create({
        data: {
            evento,
            destinatarioEmail: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
            plantillaClave: "test.plantilla",
            canal: "EMAIL",
            variables: {},
            estado,
            enviarEn,
        },
    });
}

describe("contarPendientesVencidas", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("cuenta solo ENCOLADAs con enviarEn vencido hace más del umbral", async () => {
        const ahora = Date.now();
        await crearNotificacion("ENCOLADA", new Date(ahora - 20 * 60_000)); // vencida (20min > 15min umbral)
        await crearNotificacion("ENCOLADA", new Date(ahora - 16 * 60_000)); // vencida
        await crearNotificacion("ENCOLADA", new Date(ahora - 30 * 60_000)); // vencida
        await crearNotificacion("ENCOLADA", new Date(ahora - 5 * 60_000)); // NO vencida (dentro del umbral)
        await crearNotificacion("ENVIADA", new Date(ahora - 60 * 60_000)); // NO cuenta: ya no está ENCOLADA

        const total = await contarPendientesVencidas(15);

        expect(total).toBe(3);
    });

    it("devuelve 0 cuando no hay vencidas", async () => {
        await crearNotificacion("ENCOLADA", new Date(Date.now() - 1 * 60_000));

        const total = await contarPendientesVencidas(15);

        expect(total).toBe(0);
    });

    it("respeta un umbralMinutos distinto al default", async () => {
        await crearNotificacion("ENCOLADA", new Date(Date.now() - 3 * 60_000));

        expect(await contarPendientesVencidas(1)).toBe(1);
        expect(await contarPendientesVencidas(5)).toBe(0);
    });
});
