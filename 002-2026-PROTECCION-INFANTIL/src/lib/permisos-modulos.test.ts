import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { puedeAccederAModulo, rolesConocidos } from "./permisos-modulos";

async function crearModulo(clave: string, padreId?: string) {
    return prisma.moduloPermisible.create({
        data: { clave, nombre: clave, categoria: "admin", padreId: padreId ?? null },
    });
}

async function setPermiso(rol: string, moduloId: string, activo: boolean) {
    return prisma.permisoModulo.upsert({
        where: { rol_moduloId: { rol, moduloId } },
        update: { activo },
        create: { rol, moduloId, activo },
    });
}

describe("permisos-modulos", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("deniega por defecto: sin fila → false", async () => {
        const modulo = await crearModulo("m1");
        expect(await puedeAccederAModulo("ADMIN", "m1")).toBe(false);
        await setPermiso("ADMIN", modulo.id, false);
        expect(await puedeAccederAModulo("ADMIN", "m1")).toBe(false);
    });

    it("permite con fila activa", async () => {
        const modulo = await crearModulo("m2");
        await setPermiso("ADMIN", modulo.id, true);
        expect(await puedeAccederAModulo("ADMIN", "m2")).toBe(true);
    });

    it("AND jerárquico: submódulo exige padre activo", async () => {
        const padre = await crearModulo("padre");
        const hijo = await crearModulo("hijo", padre.id);

        await setPermiso("ADMIN", hijo.id, true);
        // Padre sin permiso → hijo denegado aunque esté activo
        expect(await puedeAccederAModulo("ADMIN", "hijo")).toBe(false);

        await setPermiso("ADMIN", padre.id, true);
        expect(await puedeAccederAModulo("ADMIN", "hijo")).toBe(true);

        // Padre activo + hijo inactivo → hijo denegado, padre accesible
        await setPermiso("ADMIN", hijo.id, false);
        expect(await puedeAccederAModulo("ADMIN", "hijo")).toBe(false);
        expect(await puedeAccederAModulo("ADMIN", "padre")).toBe(true);
    });

    it("clave desconocida → false", async () => {
        expect(await puedeAccederAModulo("ADMIN", "no_existe")).toBe(false);
    });

    it("absorbe un rol nuevo con solo insertar filas (sin enum ni refactor)", async () => {
        const modulo = await crearModulo("m3");
        await setPermiso("FISCALIA", modulo.id, true);
        expect(await puedeAccederAModulo("FISCALIA", "m3")).toBe(true);
        const roles = await rolesConocidos();
        expect(roles).toContain("FISCALIA");
        expect(roles).toContain("ADMIN");
    });
});
