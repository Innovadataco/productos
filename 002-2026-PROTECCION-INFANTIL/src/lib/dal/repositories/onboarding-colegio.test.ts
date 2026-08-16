/**
 * SPEC-169 (Fase G): tests de OnboardingColegioRepository — tenant-first y
 * transiciones de estado.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { OnboardingColegioRepository } from "./onboarding-colegio";

async function crearOnboarding(colegioId: string, estado = "activo", pasoActual = 1) {
    return prisma.onboardingColegio.create({
        data: { colegioId, estado, pasoActual },
    });
}

describe("OnboardingColegioRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("obtenerPorColegio devuelve la fila del colegio", async () => {
        const { colegio } = await crearColegioConAdmin();
        await crearOnboarding(colegio.id);
        const repo = new OnboardingColegioRepository();
        const onboarding = await repo.obtenerPorColegio(colegio.id);
        expect(onboarding).not.toBeNull();
        expect(onboarding?.estado).toBe("activo");
        expect(onboarding?.pasoActual).toBe(1);
    });

    it("obtenerPorColegio de otro colegio devuelve null", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        await crearOnboarding(a.id);
        const repo = new OnboardingColegioRepository();
        expect(await repo.obtenerPorColegio(b.id)).toBeNull();
    });

    it("crear persiste una fila activa por defecto", async () => {
        const { colegio } = await crearColegioConAdmin();
        const repo = new OnboardingColegioRepository();
        const onboarding = await repo.crear({ colegioId: colegio.id });
        expect(onboarding.estado).toBe("activo");
        expect(onboarding.pasoActual).toBe(1);
    });

    it("actualizarEstado cambia el estado y los timestamps opcionales", async () => {
        const { colegio } = await crearColegioConAdmin();
        await crearOnboarding(colegio.id);
        const repo = new OnboardingColegioRepository();

        const actualizado = await repo.actualizarEstado(colegio.id, "completado", {
            pasoActual: 6,
            completadoEn: new Date("2026-08-12T00:00:00Z"),
        });
        expect(actualizado?.estado).toBe("completado");
        expect(actualizado?.pasoActual).toBe(6);
        expect(actualizado?.completadoEn).not.toBeNull();
    });

    it("actualizarEstado de un colegio sin onboarding lanza 404", async () => {
        const { colegio } = await crearColegioConAdmin();
        const repo = new OnboardingColegioRepository();
        await expect(repo.actualizarEstado(colegio.id, "omitido")).rejects.toMatchObject({ statusCode: 404 });
    });
});
