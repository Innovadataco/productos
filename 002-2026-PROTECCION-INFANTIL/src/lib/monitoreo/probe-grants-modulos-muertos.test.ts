/**
 * SPEC-745 · Guardián BLANDO de grants ACTIVOS a módulos muertos.
 *
 * Dos niveles:
 *  (a) helper PURO `grantsAModulosMuertos` (deriva de CATALOGO_MODULOS — NO la
 *      lista quemada del corrector) — decide qué grant apunta a un módulo que el
 *      código no declara.
 *  (b) CONTROL POSITIVO contra la BD real: PLANTA un módulo ∉ catálogo + un grant
 *      ACTIVO y verifica que el probe lo CAZA (ok:false nombrando clave+rol) y lo
 *      SUELTA al quitarlo. Verifica por lo que HACE (delta), no por lo que dice —
 *      una sonda mal escrita falla-a-cero (siempre verde) y este delta la delata.
 *      + un grant REVOCADO (activo=false) NO cuenta (scope de la señal).
 *
 * Requiere .env.test con DATABASE_URL. Carril de integración.
 */
import { describe, it, expect, afterAll, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { grantsAModulosMuertos } from "@/lib/permisos-catalogo";
import { probeGrantsModulosMuertos } from "./probes";

const CLAVE_FANTASMA = "modulo_fantasma_grant_spec745";

afterEach(async () => {
    // Borrar el módulo plantado arrastra su grant (PermisoModulo.onDelete = Cascade).
    await prisma.moduloPermisible.deleteMany({ where: { clave: CLAVE_FANTASMA } });
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe("grantsAModulosMuertos (puro, deriva del catálogo)", () => {
    it("un grant a una clave del catálogo NO es muerto", () => {
        expect(grantsAModulosMuertos([{ clave: "inicio_admin", rol: "ADMIN" }])).toEqual([]);
    });

    it("un grant a una clave que el catálogo no declara SÍ es muerto", () => {
        expect(grantsAModulosMuertos([{ clave: "modulo_que_no_existe", rol: "ADMIN" }])).toEqual([
            { clave: "modulo_que_no_existe", rol: "ADMIN" },
        ]);
    });

    it("ordena por clave y luego por rol", () => {
        expect(
            grantsAModulosMuertos([
                { clave: "z_fantasma", rol: "OPERADOR" },
                { clave: "a_fantasma", rol: "PARENT" },
                { clave: "a_fantasma", rol: "ADMIN" },
            ])
        ).toEqual([
            { clave: "a_fantasma", rol: "ADMIN" },
            { clave: "a_fantasma", rol: "PARENT" },
            { clave: "z_fantasma", rol: "OPERADOR" },
        ]);
    });

    it("sin grants ⇒ ninguno muerto", () => {
        expect(grantsAModulosMuertos([])).toEqual([]);
    });
});

describe("probeGrantsModulosMuertos — control positivo con grant PLANTADO (BD real)", () => {
    it("caza el grant ACTIVO a un módulo muerto (ok:false, nombra clave+rol) y lo suelta al quitarlo", async () => {
        await prisma.moduloPermisible.deleteMany({ where: { clave: CLAVE_FANTASMA } });
        const antes = await probeGrantsModulosMuertos();
        expect(antes.detalle ?? "").not.toContain(CLAVE_FANTASMA);

        const modulo = await prisma.moduloPermisible.create({
            data: { clave: CLAVE_FANTASMA, nombre: "Módulo fantasma SPEC-745", categoria: "test" },
        });
        await prisma.permisoModulo.create({
            data: { rol: "ADMIN", moduloId: modulo.id, activo: true },
        });

        const conGrant = await probeGrantsModulosMuertos();
        expect(conGrant.ok, "un grant activo a módulo muerto debe poner el probe rojo").toBe(false);
        expect(conGrant.detalle ?? "").toContain(`${CLAVE_FANTASMA} (ADMIN)`);

        // Quitar el módulo (cascade quita el grant): deja de nombrarlo.
        await prisma.moduloPermisible.deleteMany({ where: { clave: CLAVE_FANTASMA } });
        const despues = await probeGrantsModulosMuertos();
        expect(despues.detalle ?? "").not.toContain(CLAVE_FANTASMA);
    });

    it("un grant REVOCADO (activo=false) a un módulo muerto NO se marca (scope de la señal)", async () => {
        const modulo = await prisma.moduloPermisible.create({
            data: { clave: CLAVE_FANTASMA, nombre: "Módulo fantasma SPEC-745", categoria: "test" },
        });
        await prisma.permisoModulo.create({
            data: { rol: "ADMIN", moduloId: modulo.id, activo: false },
        });
        const resultado = await probeGrantsModulosMuertos();
        expect(resultado.detalle ?? "").not.toContain(CLAVE_FANTASMA);
    });

    it("un grant a una clave del catálogo NO se marca huérfano (no falso positivo)", async () => {
        const resultado = await probeGrantsModulosMuertos();
        expect(resultado.detalle ?? "").not.toContain("inicio_admin");
    });
});
