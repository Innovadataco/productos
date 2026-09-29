/**
 * CANDADO del restablecimiento de credenciales e2e (colegio/operador/comité) — el arreglo del 401.
 *
 * Prueba, contra la BD, lo que corre el CEO en prod: las 3 cuentas quedan CON LOGIN POSIBLE
 * (existe + rol correcto + estado activo + `verifyPassword(clave_entorno, hash)` = true → no 401),
 * en la corrida PERSISTENTE, idempotente (2ª corrida no duplica ni re-hashea), y con las guardas de
 * entorno (falta variable / cuenta intocable) que abortan sin escribir.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { verifyPassword } from "@/lib/auth";
import { EMAIL_INTOCABLE } from "../../scripts/lib/credenciales-e2e-calidad";
import {
    sembrarCredencialesRoles,
    leerCredencialesRoles,
    CORRIDA_CUENTAS_CALIDAD,
    type CredencialRol,
} from "../../scripts/seed-e2e-credenciales-roles";

const CREDS: CredencialRol[] = [
    { clave: "COLEGIO", rol: "SCHOOL_ADMIN", nombre: "Colegio Calidad (E2E · login)", requiereColegio: true, email: "calidad+e2ecolegio@innovadataco.com", secreto: "ClaveColegio2026!" },
    { clave: "OPERADOR", rol: "OPERADOR", nombre: "Operador Calidad (E2E)", requiereColegio: false, email: "calidad+e2eoperador@innovadataco.com", secreto: "ClaveOperador2026!" },
    { clave: "COMITE", rol: "COMITE_VALIDACION", nombre: "Comité-Validación Calidad (E2E)", requiereColegio: false, email: "calidad+e2ecomite@innovadataco.com", secreto: "ClaveComite2026!" },
];

async function sembrarBase(): Promise<{ paisId: string; ciudadId: string }> {
    const pais = await prisma.pais.upsert({ where: { codigo: "CO" }, update: {}, create: { codigo: "CO", nombre: "Colombia" } });
    let bogota = await prisma.ciudad.findFirst({ where: { nombre: "Bogotá", paisId: pais.id }, select: { id: true } });
    bogota ??= await prisma.ciudad.create({ data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id }, select: { id: true } });
    return { paisId: pais.id, ciudadId: bogota.id };
}

function correr(base: { paisId: string; ciudadId: string }) {
    return prisma.$transaction((tx) => sembrarCredencialesRoles(tx, CREDS, base));
}

describe("credenciales e2e de roles (colegio/operador/comité) · arreglo del 401", () => {
    let base: { paisId: string; ciudadId: string };
    beforeEach(async () => {
        await resetDatabase();
        base = await sembrarBase();
    });

    it("las 3 cuentas quedan con LOGIN POSIBLE (rol + activo + clave del entorno verifica)", async () => {
        await correr(base);
        for (const cred of CREDS) {
            const u = await prisma.usuario.findUniqueOrThrow({
                where: { email: cred.email },
                select: { rol: true, estado: true, estadoActivacion: true, passwordHash: true, tenantId: true, colegioId: true },
            });
            expect(u.rol).toBe(cred.rol);
            expect(u.estado, "estado inactivo → login 401").toBe("activo");
            expect(u.estadoActivacion).toBe("ACTIVO");
            expect(await verifyPassword(cred.secreto, u.passwordHash), "la clave del entorno DEBE verificar (si no, 401)").toBe(true);
            if (cred.requiereColegio) {
                expect(u.tenantId, "SCHOOL_ADMIN necesita tenant").not.toBeNull();
                expect(u.colegioId, "SCHOOL_ADMIN necesita colegio").not.toBeNull();
            }
        }
    });

    it("IDEMPOTENTE: la 2ª corrida no duplica cuenta/colegio y no re-hashea (clave ya OK)", async () => {
        await correr(base);
        const { resultados } = await correr(base);
        for (const r of resultados) {
            expect(r.creado, `${r.rol} no se re-crea`).toBe(false);
            expect(r.rehashClave, `${r.rol} no re-hashea la clave en la 2ª corrida`).toBe(false);
        }
        for (const cred of CREDS) {
            expect(await prisma.usuario.count({ where: { email: cred.email } })).toBe(1);
        }
        expect(await prisma.colegio.count({ where: { tenant: { nombre: "e2e-calidad-colegio-login" } } }), "el colegio de login no se duplica").toBe(1);
    });

    it("cuentas marcadas en la corrida PERSISTENTE (no la purgable)", async () => {
        const { resultados } = await correr(base);
        for (const r of resultados) {
            const marca = await prisma.demoMarcado.findFirst({ where: { entidad: "Usuario", entidadId: r.usuarioId } });
            expect((marca?.metadata as { corrida?: string } | null)?.corrida).toBe(CORRIDA_CUENTAS_CALIDAD);
        }
    });

    it("GUARDAS de entorno: falta variable → aborta; cuenta intocable → aborta (sin escribir)", () => {
        expect(() => leerCredencialesRoles({}), "falta variable").toThrow(/Faltan variables/);
        const envIntocable = {
            E2E_COLEGIO_EMAIL: EMAIL_INTOCABLE,
            E2E_COLEGIO_PASSWORD: "x",
            E2E_OPERADOR_EMAIL: "a@ejemplo.local",
            E2E_OPERADOR_PASSWORD: "x",
            E2E_COMITE_EMAIL: "c@ejemplo.local",
            E2E_COMITE_PASSWORD: "x",
        };
        expect(() => leerCredencialesRoles(envIntocable), "cuenta intocable").toThrow(/intocable/i);
    });
});
