/**
 * SPEC-612 · CANDADO DE INTEGRACIÓN (con base) — idempotencia real de la siembra de cuentas de Calidad.
 *
 * Vive en `src/**` a propósito: la suite de integración (que sí levanta base) corre `src/**​/*.test.ts`;
 * la suite unit NO tiene base, así que un candado que toca Prisma no puede ir ahí (esa fue la lección de
 * I-366/612 — «unit verde en local» ≠ «unit verde en CI» cuando el local tiene base). El sembrado vive en
 * `scripts/seed-e2e-cuentas-calidad.ts`; acá se ejercita corriéndolo DOS veces, no declarándolo.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { verifyPassword } from "@/lib/auth";
import { sembrarCuentasE2E, leerCredencialesE2E } from "../../scripts/seed-e2e-cuentas-calidad";

const ENV_COMPLETO: Record<string, string> = {
    E2E_PADRE_EMAIL: "padre.e2e.calidad@example.com",
    E2E_PADRE_PASSWORD: "DummyCalidadUno-2026",
    E2E_PADRE2_EMAIL: "padre2.e2e.calidad@example.com",
    E2E_PADRE2_PASSWORD: "DummyCalidadDos-2026",
    E2E_PROFESIONAL_EMAIL: "profesional.e2e.calidad@example.com",
    E2E_PROFESIONAL_PASSWORD: "DummyCalidadTres-2026",
};

const EMAILS = [ENV_COMPLETO.E2E_PADRE_EMAIL, ENV_COMPLETO.E2E_PADRE2_EMAIL, ENV_COMPLETO.E2E_PROFESIONAL_EMAIL];

async function ciudadDePrueba(): Promise<string> {
    const existente = await prisma.ciudad.findFirst({ select: { id: true } });
    if (existente) return existente.id;
    const pais = await prisma.pais.create({ data: { codigo: "ZZ", nombre: "País E2E" } });
    const ciudad = await prisma.ciudad.create({ data: { nombre: "Ciudad E2E", paisId: pais.id } });
    return ciudad.id;
}

async function snapshot() {
    return prisma.usuario.findMany({
        where: { email: { in: EMAILS } },
        select: { id: true, email: true, rol: true, estado: true, estadoActivacion: true, passwordHash: true },
        orderBy: { email: "asc" },
    });
}

describe("SPEC-612 · siembra de cuentas de Calidad (integración)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("idempotente: dos corridas seguidas dejan el MISMO estado (ids y hash incluidos)", async () => {
        const ciudadId = await ciudadDePrueba();
        const cuentas = leerCredencialesE2E(ENV_COMPLETO);

        const run1 = await prisma.$transaction((tx) => sembrarCuentasE2E(tx, cuentas, ciudadId));
        const snap1 = await snapshot();
        const run2 = await prisma.$transaction((tx) => sembrarCuentasE2E(tx, cuentas, ciudadId));
        const snap2 = await snapshot();

        expect(run1.every((r) => r.creado), "la primera corrida crea las 3").toBe(true);
        expect(run2.some((r) => r.creado), "la segunda NO crea ninguna").toBe(false);
        expect(snap2).toHaveLength(3);
        // MISMO estado, byte a byte: ids, rol, estado y —clave de la idempotencia real— el passwordHash.
        expect(snap2).toEqual(snap1);

        // El profesional alcanza su panel: tiene un PerfilProfesional (y no se duplica).
        const profesional = snap2.find((u) => u.rol === "PROFESIONAL");
        expect(profesional).toBeDefined();
        const perfiles = await prisma.perfilProfesional.count({ where: { usuarioId: profesional!.id } });
        expect(perfiles, "exactamente un PerfilProfesional, idempotente").toBe(1);
    });

    it("clave local real: las 3 tienen hash que valida la clave del entorno (entra por /login), no solo-Google", async () => {
        const ciudadId = await ciudadDePrueba();
        const cuentas = leerCredencialesE2E(ENV_COMPLETO);
        await prisma.$transaction((tx) => sembrarCuentasE2E(tx, cuentas, ciudadId));

        for (const c of cuentas) {
            const u = await prisma.usuario.findUnique({ where: { email: c.email }, select: { passwordHash: true, googleSub: true } });
            expect(u, c.email).not.toBeNull();
            expect(u!.googleSub, "cuenta con clave local, no solo-Google").toBeNull();
            expect(await verifyPassword(c.secreto, u!.passwordHash), `la clave del entorno valida para ${c.email}`).toBe(true);
        }
    });
});
