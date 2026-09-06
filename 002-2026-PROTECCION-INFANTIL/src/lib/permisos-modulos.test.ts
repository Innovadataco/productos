import { describe, it, expect, beforeEach } from "vitest";
import type { RolUsuario } from "@prisma/client";
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
        where: { rol_moduloId: { rol: rol as RolUsuario, moduloId } },
        update: { activo },
        create: { rol: rol as RolUsuario, moduloId, activo },
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
        const padre = await crearModulo("padre_test");
        const hijo = await crearModulo("hijo", padre.id);

        await setPermiso("ADMIN", hijo.id, true);
        // Padre sin permiso → hijo denegado aunque esté activo
        expect(await puedeAccederAModulo("ADMIN", "hijo")).toBe(false);

        await setPermiso("ADMIN", padre.id, true);
        expect(await puedeAccederAModulo("ADMIN", "hijo")).toBe(true);

        // Padre activo + hijo inactivo → hijo denegado, padre accesible
        await setPermiso("ADMIN", hijo.id, false);
        expect(await puedeAccederAModulo("ADMIN", "hijo")).toBe(false);
        expect(await puedeAccederAModulo("ADMIN", "padre_test")).toBe(true);
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

    it("SPEC-509 (D-116): un rol fuera del enum NO entra por texto libre — la BD lo rechaza", async () => {
        const modulo = await crearModulo("m3");
        // Contrato NUEVO: SPEC-509 DEROGA «absorbe un rol nuevo insertando filas». Un rol
        // inventado como 'FISCALIA' ya no puede colarse por texto libre a la tabla que decide
        // permisos; un rol nuevo exige código (enum + guardas + nav), no una fila suelta.
        // Candado de conducta: con `PermisoModulo.rol` String este insert entraría y el test
        // se pondría ROJO; con el enum RolUsuario, es rechazado.
        await expect(setPermiso("FISCALIA", modulo.id, true)).rejects.toThrow();
        // `rolesConocidos()` es exactamente el enum: incluye ADMIN, nunca un rol inventado.
        const roles = await rolesConocidos();
        expect(roles).toContain("ADMIN");
        expect(roles).not.toContain("FISCALIA");
    });

    // Spec 096 + SPEC-266 (002-PI-169): expediente_revelar_original es módulo
    // STANDALONE (sin padre). Antes tenía padre bandeja_reportes; SPEC-266 lo
    // desancló para que COMITE_VALIDACION pueda revelar el original sin recibir
    // toda la bandeja del operador (I-128).
    it("expediente_revelar_original: standalone, ADMIN sí, OPERADOR denegar por defecto", async () => {
        const catalogoRevelar = CATALOGO_MODULOS.find((m) => m.clave === "expediente_revelar_original");
        expect(catalogoRevelar).toBeDefined();
        expect(catalogoRevelar?.padre).toBeUndefined();
        expect(catalogoRevelar?.esCritico).toBe(true);
        expect(catalogoRevelar?.categoria).toBe("operador");
        expect(catalogoRevelar?.orden).toBe(31);

        const revelar = await prisma.moduloPermisible.findUniqueOrThrow({ where: { clave: "expediente_revelar_original" } });
        expect(revelar.padreId).toBeNull();

        // Backfill del seed: ADMIN recibe todos los módulos del catálogo
        await setPermiso("ADMIN", revelar.id, true);
        expect(await puedeAccederAModulo("ADMIN", "expediente_revelar_original")).toBe(true);

        // OPERADOR sin el grant → denegar por defecto
        await setPermiso("OPERADOR", revelar.id, false);
        expect(await puedeAccederAModulo("OPERADOR", "expediente_revelar_original")).toBe(false);

        // Otorgarlo manualmente a OPERADOR habilita (ya no depende de padre)
        await setPermiso("OPERADOR", revelar.id, true);
        expect(await puedeAccederAModulo("OPERADOR", "expediente_revelar_original")).toBe(true);
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
