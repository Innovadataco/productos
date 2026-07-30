/**
 * SPEC-128 (D-43, Opción A aprobada por ZEUS) — revocación idempotente de los grants
 * muertos del comité en BD existentes. Creado primero en ROJO contra el script ausente.
 * Verifica: el comité pierde los grants comite/comite_auditoria (activo=false, filas
 * conservadas), ADMIN intacto, los módulos NO se borran del catálogo y la segunda
 * corrida no cambia nada (idempotencia).
 * El arranque usa resetDatabase(), que siembra el catálogo y concede TODOS los módulos
 * a TODOS los roles: reproduce una BD "vieja" donde el comité tiene los grants muertos.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { revocarGrantsComiteMuertos } from "./revocar-grants-comite-muertos";

const ROL_COMITE = "COMITE_VALIDACION";
const MODULOS_MUERTOS = ["comite", "comite_auditoria"];

const filtroMuertosComite = {
    rol: ROL_COMITE,
    modulo: { clave: { in: MODULOS_MUERTOS } },
};

describe("revocar-grants-comite-muertos (SPEC-128, D-43 Opción A)", () => {
    beforeAll(async () => {
        await resetDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("revoca comite y comite_auditoria del comité (activo=false, sin borrar filas)", async () => {
        // Precondición de la BD "vieja": el comité tiene los grants muertos activos.
        const antesActivos = await prisma.permisoModulo.count({ where: { ...filtroMuertosComite, activo: true } });
        expect(antesActivos).toBe(2);

        const resultado = await revocarGrantsComiteMuertos();
        expect(resultado.revocados).toBe(2);

        // Ya no queda ninguno activo, pero las filas siguen existiendo (no destructivo).
        const activos = await prisma.permisoModulo.count({ where: { ...filtroMuertosComite, activo: true } });
        expect(activos).toBe(0);
        const filas = await prisma.permisoModulo.count({ where: filtroMuertosComite });
        expect(filas).toBe(2);

        // Su bandeja sigue activa.
        const bandeja = await prisma.permisoModulo.count({
            where: { rol: ROL_COMITE, activo: true, modulo: { clave: "comite_bandeja" } },
        });
        expect(bandeja).toBe(1);
    });

    it("no toca a ADMIN ni borra módulos del catálogo", async () => {
        const adminComite = await prisma.permisoModulo.count({
            where: { rol: "ADMIN", activo: true, modulo: { clave: { in: MODULOS_MUERTOS } } },
        });
        expect(adminComite).toBe(2);

        const modulos = await prisma.moduloPermisible.count({
            where: { clave: { in: [...MODULOS_MUERTOS, "comite_bandeja"] } },
        });
        expect(modulos).toBe(3);
    });

    it("es idempotente: la segunda corrida no revoca nada más", async () => {
        const segunda = await revocarGrantsComiteMuertos();
        expect(segunda.revocados).toBe(0);
        expect(segunda.yaInactivos).toBe(2);
    });
});
