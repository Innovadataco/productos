/**
 * CANDADO · SPEC-288 · el rector de cada colegio A/B queda con LOGIN POSIBLE y clave ESTABLE.
 *
 * Antes `seed-e2e-multi-tenant.ts` generaba una clave ALEATORIA en cada corrida → cualquier
 * re-siembra desincronizaba la clave que Calidad tenía guardada → 401. Ahora la clave es del
 * ENTORNO (E2E_COLEGIO_{A,B}_ADMIN_PASSWORD) y `upsertRectorColegio` la re-hashea SOLO si cambió
 * (patrón #709/SPEC-612).
 *
 * Prueba la CONDUCTA contra la BD (no la forma del sembrador): verifyPassword(clave_entorno, hash)
 * = true → login posible → no 401; 2ª corrida con la MISMA clave no re-hashea (hash byte-idéntico);
 * si la clave del entorno CAMBIA, re-hashea y el login sigue con la clave nueva (el arreglo del
 * 401). Control positivo: si el upsert dejara de re-hashear al cambiar la clave, el test «re-hash
 * si cambia» se pone rojo.
 *
 * Las dos claves son INDEPENDIENTES (una variable por colegio): estables pero distintas, nunca
 * compartida. El aislamiento A/B lo da el TENANT, no la clave. Se prueba el upsert del rector
 * aislado (no la siembra completa de curso/alumnos/reporte): afirma el login, que es lo pedido.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { verifyPassword } from "@/lib/auth";
import { upsertRectorColegio, leerPasswordsColegios } from "../../scripts/seed-e2e-multi-tenant";

const PASSWORD_A = "ClaveColegioA-2026!";
const PASSWORD_B = "ClaveColegioB-2026!";
const emailRector = (letra: "A" | "B") => `soporte+e2e-colegio-${letra.toLowerCase()}@innovadataco.com`;

interface ColegioIds {
    tenantId: string;
    colegioId: string;
}

async function sembrarGeo(): Promise<{ paisId: string; ciudadId: string }> {
    const pais = await prisma.pais.upsert({ where: { codigo: "CO" }, update: {}, create: { codigo: "CO", nombre: "Colombia" } });
    let bogota = await prisma.ciudad.findFirst({ where: { nombre: "Bogotá", paisId: pais.id }, select: { id: true } });
    bogota ??= await prisma.ciudad.create({ data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id }, select: { id: true } });
    return { paisId: pais.id, ciudadId: bogota.id };
}

async function crearColegio(tx: Prisma.TransactionClient, letra: "A" | "B", paisId: string, ciudadId: string): Promise<ColegioIds> {
    const tenant = await tx.tenant.create({ data: { nombre: `e2e-multi-tenant-${letra}` }, select: { id: true } });
    const colegio = await tx.colegio.create({
        data: {
            nombre: `Calidad · Colegio ${letra}`,
            nit: `E2E-NIT-${letra}`,
            paisId,
            ciudadId,
            representanteLegalNombre: `Representante E2E ${letra}`,
            representanteLegalIdentificacion: `E2E-${letra}-000`,
            representanteLegalEmail: emailRector(letra),
            inicioServicio: new Date("2026-01-01T00:00:00Z"),
            tipoPeriodo: "ANUAL",
            estado: "activo",
            tenantId: tenant.id,
        },
        select: { id: true },
    });
    return { tenantId: tenant.id, colegioId: colegio.id };
}

async function hashDe(letra: "A" | "B"): Promise<string> {
    const u = await prisma.usuario.findUniqueOrThrow({ where: { email: emailRector(letra) }, select: { passwordHash: true } });
    return u.passwordHash;
}

describe("SPEC-288 · rector A/B con login posible y clave estable del entorno", () => {
    let col: Record<"A" | "B", ColegioIds>;
    beforeEach(async () => {
        await resetDatabase();
        const { paisId, ciudadId } = await sembrarGeo();
        col = await prisma.$transaction(async (tx) => ({
            A: await crearColegio(tx, "A", paisId, ciudadId),
            B: await crearColegio(tx, "B", paisId, ciudadId),
        }));
    });

    const rector = (letra: "A" | "B", password: string) =>
        prisma.$transaction((tx) => upsertRectorColegio(tx, letra, password, col[letra].tenantId, col[letra].colegioId));

    it("A y B quedan con LOGIN POSIBLE (SCHOOL_ADMIN activo + clave del entorno verifica), en tenants distintos y con claves independientes", async () => {
        await rector("A", PASSWORD_A);
        await rector("B", PASSWORD_B);
        const ua = await prisma.usuario.findUniqueOrThrow({
            where: { email: emailRector("A") },
            select: { rol: true, estado: true, estadoActivacion: true, passwordHash: true, tenantId: true, colegioId: true },
        });
        const ub = await prisma.usuario.findUniqueOrThrow({ where: { email: emailRector("B") }, select: { tenantId: true, passwordHash: true } });
        expect(ua.rol).toBe("SCHOOL_ADMIN");
        expect(ua.estado, "estado inactivo → 401").toBe("activo");
        expect(ua.estadoActivacion).toBe("ACTIVO");
        expect(await verifyPassword(PASSWORD_A, ua.passwordHash), "la clave del entorno DEBE verificar (si no, 401)").toBe(true);
        expect(ua.tenantId, "SCHOOL_ADMIN necesita tenant").not.toBeNull();
        expect(ua.colegioId, "SCHOOL_ADMIN necesita colegio").not.toBeNull();
        expect(await verifyPassword(PASSWORD_B, ub.passwordHash)).toBe(true);
        expect(ua.tenantId, "A y B en tenants distintos (aislamiento)").not.toBe(ub.tenantId);
        expect(await verifyPassword(PASSWORD_B, ua.passwordHash), "la clave de B no abre la cuenta de A (independientes)").toBe(false);
    });

    it("clave ESTABLE: la 2ª corrida con la MISMA clave NO re-hashea y el hash queda byte-idéntico", async () => {
        await rector("A", PASSWORD_A);
        const h1 = await hashDe("A");
        const segunda = await rector("A", PASSWORD_A);
        expect(segunda.rehashClave, "clave sin cambios → no re-hashea").toBe(false);
        const h2 = await hashDe("A");
        expect(h2, "el hash no cambia si la clave no cambió → Calidad no pierde su login").toBe(h1);
        expect(await verifyPassword(PASSWORD_A, h2)).toBe(true);
    });

    it("re-hash SOLO si la clave del entorno CAMBIA (arreglo del 401 · control positivo): rota el hash, la clave nueva entra y la vieja no", async () => {
        await rector("A", PASSWORD_A);
        const nueva = "ClaveColegioA-ROTADA-2026!";
        const segunda = await rector("A", nueva);
        expect(segunda.rehashClave, "clave distinta → re-hashea").toBe(true);
        const h = await hashDe("A");
        expect(await verifyPassword(nueva, h), "login con la clave NUEVA del entorno").toBe(true);
        expect(await verifyPassword(PASSWORD_A, h), "la clave vieja ya NO entra").toBe(false);
    });

    it("GUARDA de entorno: falta una variable → aborta sin escribir; trim de espacios", () => {
        expect(() => leerPasswordsColegios({ E2E_COLEGIO_A_ADMIN_PASSWORD: "x" }), "falta B").toThrow(/Faltan variables/);
        expect(() => leerPasswordsColegios({}), "faltan ambas").toThrow(/E2E_COLEGIO_A_ADMIN_PASSWORD/);
        expect(leerPasswordsColegios({ E2E_COLEGIO_A_ADMIN_PASSWORD: " pa ", E2E_COLEGIO_B_ADMIN_PASSWORD: "pb" })).toEqual({ A: "pa", B: "pb" });
    });
});
