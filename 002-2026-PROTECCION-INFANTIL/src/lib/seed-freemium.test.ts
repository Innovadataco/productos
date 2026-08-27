/**
 * SPEC-293 (002-PI-194 · cierra I-156): ratchet CI del seed de planes freemium.
 *
 * Ejecuta `prisma/seed.ts` como proceso separado contra la BD de test y verifica:
 * 1. Existen exactamente 2 planes freemium activos del año actual (PADRE + COLEGIO).
 * 2. Un plan MES_1 heredado con esFreemium=false queda curado tras el seed.
 * 3. Un precio editado por el admin en un plan pago NO se pisa.
 *
 * Falla el CI si un cambio futuro del seed regresa el bug del I-156.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { prisma } from "./prisma";
import { resetDatabase } from "./test-utils";
import { RolUsuario, TipoTitular, DuracionPlan } from "@prisma/client";

const REPO_ROOT = resolve(__dirname, "..", "..");
const SEED_CMD = "npx tsx prisma/seed.ts";
const ANIO = new Date().getFullYear();

function correrSeed() {
    execSync(SEED_CMD, {
        cwd: REPO_ROOT,
        stdio: "pipe",
        env: {
            ...process.env,
            DATABASE_URL: process.env.DATABASE_URL,
        },
    });
}

describe("seed-freemium (SPEC-293 · cierra I-156)", () => {
    beforeAll(async () => {
        await resetDatabase();
        // El seed omite seedPlanesPagos() si no hay admin (línea 1803 de seed.ts).
        // Sembramos uno explícito antes de correrlo.
        await prisma.usuario.create({
            data: {
                email: `seed-freemium-admin-${Date.now()}@test.local`,
                passwordHash: "hash",
                rol: RolUsuario.ADMIN,
                estado: "activo",
            },
        });
        correrSeed();
    }, 120_000);

    it("crea exactamente 2 planes freemium activos del año actual (PADRE + COLEGIO)", async () => {
        const freemiums = await prisma.plan.findMany({
            where: { esFreemium: true, activo: true, anio: ANIO },
            orderBy: { tipoTitular: "asc" },
        });
        expect(freemiums).toHaveLength(2);
        expect(freemiums.map((p) => p.tipoTitular)).toEqual([TipoTitular.COLEGIO, TipoTitular.PADRE]);
        expect(freemiums.every((p) => p.precioBaseCOP === 0)).toBe(true);
        expect(freemiums.every((p) => p.usosMaximosPorCliente === 1)).toBe(true);
        expect(freemiums.every((p) => p.duracion === DuracionPlan.MES_1)).toBe(true);
    });

    it("cura estado heredado: PADRE MES_1 con esFreemium=false → true tras seed (I-156)", async () => {
        // Rompe a mano el plan freemium (simula el estado prod pre-fix).
        await prisma.plan.update({
            where: {
                tipoTitular_duracion_anio: {
                    tipoTitular: TipoTitular.PADRE,
                    duracion: DuracionPlan.MES_1,
                    anio: ANIO,
                },
            },
            data: { esFreemium: false, activo: false, precioBaseCOP: 99999 },
        });
        // Segunda corrida del seed cura las filas freemium.
        correrSeed();
        const padreMes1 = await prisma.plan.findUnique({
            where: {
                tipoTitular_duracion_anio: {
                    tipoTitular: TipoTitular.PADRE,
                    duracion: DuracionPlan.MES_1,
                    anio: ANIO,
                },
            },
        });
        expect(padreMes1?.esFreemium).toBe(true);
        expect(padreMes1?.activo).toBe(true);
        expect(padreMes1?.precioBaseCOP).toBe(0);
        expect(padreMes1?.usosMaximosPorCliente).toBe(1);
    }, 120_000);

    it("NO pisa ediciones del admin en planes pagos (PADRE MES_3 mantiene precio editado)", async () => {
        await prisma.plan.update({
            where: {
                tipoTitular_duracion_anio: {
                    tipoTitular: TipoTitular.PADRE,
                    duracion: DuracionPlan.MES_3,
                    anio: ANIO,
                },
            },
            data: { precioBaseCOP: 42999 },
        });
        correrSeed();
        const padreMes3 = await prisma.plan.findUnique({
            where: {
                tipoTitular_duracion_anio: {
                    tipoTitular: TipoTitular.PADRE,
                    duracion: DuracionPlan.MES_3,
                    anio: ANIO,
                },
            },
        });
        expect(padreMes3?.precioBaseCOP).toBe(42999);
        expect(padreMes3?.esFreemium).toBe(false);
    }, 120_000);
});
