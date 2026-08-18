import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { CATALOGO_MODULOS } from "./permisos-catalogo";
import { puedeAccederAModulo, rolesConocidos, modulosPermitidosParaRol } from "./permisos-modulos";
import { syncModulosYGrants } from "../../prisma/seed-modulos-grants";

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

    it("monitoreo_worker: ADMIN sí, OPERADOR no (módulo exclusivo de admin)", async () => {
        const modulo = await prisma.moduloPermisible.findUnique({ where: { clave: "monitoreo_worker" } });
        expect(modulo).not.toBeNull();
        await setPermiso("ADMIN", modulo!.id, true);
        await setPermiso("OPERADOR", modulo!.id, false);
        expect(await puedeAccederAModulo("ADMIN", "monitoreo_worker")).toBe(true);
        expect(await puedeAccederAModulo("OPERADOR", "monitoreo_worker")).toBe(false);
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

    // Spec 096: expediente_revelar_original (padre bandeja_reportes).
    // resetDatabase + otorgarTodosLosPermisos recrean el catálogo y lo otorgan
    // a todos los roles; aquí se reproduce el backfill real del seed
    // (ADMIN = todos, OPERADOR = solo bandeja_reportes) ajustando los permisos.
    it("expediente_revelar_original: ADMIN sí, OPERADOR no (denegar por defecto)", async () => {
        const catalogoRevelar = CATALOGO_MODULOS.find((m) => m.clave === "expediente_revelar_original");
        expect(catalogoRevelar).toBeDefined();
        expect(catalogoRevelar?.padre).toBe("bandeja_reportes");
        expect(catalogoRevelar?.esCritico).toBe(true);
        expect(catalogoRevelar?.categoria).toBe("operador");
        expect(catalogoRevelar?.orden).toBe(31);

        const padre = await prisma.moduloPermisible.findUniqueOrThrow({ where: { clave: "bandeja_reportes" } });
        const revelar = await prisma.moduloPermisible.findUniqueOrThrow({ where: { clave: "expediente_revelar_original" } });
        expect(revelar.padreId).toBe(padre.id);

        // Backfill del seed: ADMIN recibe todos los módulos del catálogo
        await setPermiso("ADMIN", padre.id, true);
        await setPermiso("ADMIN", revelar.id, true);
        expect(await puedeAccederAModulo("ADMIN", "expediente_revelar_original")).toBe(true);

        // OPERADOR conserva solo bandeja_reportes → sin revelación por defecto
        await setPermiso("OPERADOR", padre.id, true);
        await setPermiso("OPERADOR", revelar.id, false);
        expect(await puedeAccederAModulo("OPERADOR", "expediente_revelar_original")).toBe(false);

        // Otorgarlo manualmente a OPERADOR sí habilita (padre activo AND propio activo)
        await setPermiso("OPERADOR", revelar.id, true);
        expect(await puedeAccederAModulo("OPERADOR", "expediente_revelar_original")).toBe(true);

        // Jerarquía AND: sin el padre, el submódulo se deniega aunque esté activo
        await setPermiso("OPERADOR", padre.id, false);
        expect(await puedeAccederAModulo("OPERADOR", "expediente_revelar_original")).toBe(false);
    });

    it("I-57 (SPEC-175): COMITE_CONVIVENCIA obtiene su bandeja con los grants REALES del seed y nada del rector", async () => {
        // resetDatabase() otorga todo a todos (aislamiento de la suite); aquí medimos
        // los grants REALES del seed: limpiamos y aplicamos el sync de verdad.
        await prisma.permisoModulo.deleteMany({});
        await syncModulosYGrants(prisma);

        const permitidos = await modulosPermitidosParaRol("COMITE_CONVIVENCIA");
        // La bandeja queda concedida (padre `colegios` + hija activos: jerarquía AND).
        expect(permitidos.has("colegios_comite_bandeja")).toBe(true);
        // Candado: el comité NO gana los módulos del rector.
        expect(permitidos.has("colegios_gestion")).toBe(false);
        expect(permitidos.has("colegios_comite")).toBe(false);
        expect(permitidos.has("colegios_auditoria")).toBe(false);
        expect(permitidos.has("colegios_onboarding")).toBe(false);
        expect(permitidos.has("colegios_notificaciones")).toBe(false);
    });
});
