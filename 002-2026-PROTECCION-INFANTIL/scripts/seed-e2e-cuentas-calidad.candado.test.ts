/**
 * SPEC-612 · CANDADOS de la semilla de cuentas de Calidad.
 *
 * 1. Idempotencia de CONDUCTA (no declarada): dos corridas seguidas dejan exactamente el mismo estado
 *    —mismos usuarios, mismos ids y el MISMO hash— porque la clave solo se re-hashea si cambió en el
 *    entorno. Se ejercita corriendo el sembrado dos veces, no afirmándolo.
 * 2. Configuración: con una variable ausente, `leerCredencialesE2E` ABORTA y —al ser pura— no escribe
 *    nada. Se ejercita la AUSENCIA, no la presencia.
 *
 * (Anti-literal SPEC-107: este archivo es `.test.` y queda excluido de esa guarda; aun así las claves
 * de abajo son valores dummy obvios, nunca credenciales reales.)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { leerCredencialesE2E, sembrarCuentasE2E } from "./seed-e2e-cuentas-calidad";

// Entorno completo de prueba (valores dummy; un `.test.` no pasa por la guarda SPEC-107).
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
    const usuarios = await prisma.usuario.findMany({
        where: { email: { in: EMAILS } },
        select: { id: true, email: true, rol: true, estado: true, estadoActivacion: true, passwordHash: true },
        orderBy: { email: "asc" },
    });
    return usuarios;
}

describe("SPEC-612 · semilla de cuentas de Calidad", { timeout: 30_000 }, () => {
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

    it("con clave local real: las 3 cuentas tienen hash que valida la clave del entorno (entra por /login)", async () => {
        const { verifyPassword } = await import("@/lib/auth");
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

    it("configuración: con una variable ausente, leerCredencialesE2E ABORTA (y al ser pura, no escribe)", () => {
        const sinUna = { ...ENV_COMPLETO };
        delete sinUna.E2E_PROFESIONAL_PASSWORD;
        expect(() => leerCredencialesE2E(sinUna)).toThrow(/E2E_PROFESIONAL_PASSWORD/);
    });

    it("configuración: entorno vacío → aborta nombrando varias variables faltantes", () => {
        expect(() => leerCredencialesE2E({})).toThrow(/E2E_PADRE_EMAIL/);
    });

    it("nunca siembra la cuenta intocable: si una var apunta a soporte@, aborta", () => {
        const conIntocable = { ...ENV_COMPLETO, E2E_PADRE_EMAIL: "soporte@innovadataco.com" };
        expect(() => leerCredencialesE2E(conIntocable)).toThrow(/intocable|soporte@innovadataco\.com/);
    });
});
