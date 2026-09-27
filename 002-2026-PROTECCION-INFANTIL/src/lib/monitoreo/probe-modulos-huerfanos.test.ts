/**
 * SPEC-739 · Guardián BLANDO de módulos huérfanos.
 *
 * Dos niveles:
 *  (a) helper PURO `clavesModuloHuerfanas` (fuente única compartida con el barrido
 *      de Datos, SPEC-725) — decide qué clave de la BD no declara el catálogo.
 *  (b) CONTROL POSITIVO contra la BD real: PLANTA una fila `ModuloPermisible`
 *      huérfana y verifica que el probe la CAZA (ok:false nombrándola) y la SUELTA
 *      al quitarla. Verifica por lo que HACE, no por lo que dice: una sonda mal
 *      escrita falla hacia CERO (siempre verde) y este delta la delata.
 *
 * Requiere .env.test con DATABASE_URL. Corre en el carril de integración.
 */
import { describe, it, expect, afterAll, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { clavesModuloHuerfanas } from "@/lib/permisos-catalogo";
import { probeModulosHuerfanos } from "./probes";

const CLAVE_FANTASMA = "modulo_fantasma_spec739";

afterEach(async () => {
    // Higiene: nunca dejar la fila plantada (aunque un expect falle a mitad).
    await prisma.moduloPermisible.deleteMany({ where: { clave: CLAVE_FANTASMA } });
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe("clavesModuloHuerfanas (puro, fuente única con el barrido SPEC-725)", () => {
    it("una clave del catálogo NO es huérfana", () => {
        expect(clavesModuloHuerfanas(["inicio_admin"])).toEqual([]);
    });

    it("una clave que el catálogo no declara SÍ es huérfana", () => {
        expect(clavesModuloHuerfanas(["inicio_admin", "modulo_que_no_existe"])).toEqual(["modulo_que_no_existe"]);
    });

    it("deduplica y ordena", () => {
        expect(clavesModuloHuerfanas(["z_fantasma", "a_fantasma", "z_fantasma"])).toEqual([
            "a_fantasma",
            "z_fantasma",
        ]);
    });

    it("sin claves en la BD ⇒ sin huérfanas", () => {
        expect(clavesModuloHuerfanas([])).toEqual([]);
    });
});

describe("probeModulosHuerfanos — control positivo con fila PLANTADA (BD real)", () => {
    it("caza la huérfana plantada (ok:false, la nombra) y la suelta al quitarla", async () => {
        // Punto de partida: la clave fantasma no está → el probe no la menciona.
        await prisma.moduloPermisible.deleteMany({ where: { clave: CLAVE_FANTASMA } });
        const antes = await probeModulosHuerfanos();
        expect(antes.detalle ?? "").not.toContain(CLAVE_FANTASMA);

        // Plantar una fila que el catálogo del código NO declara.
        await prisma.moduloPermisible.create({
            data: { clave: CLAVE_FANTASMA, nombre: "Módulo fantasma SPEC-739", categoria: "test" },
        });
        const conHuerfana = await probeModulosHuerfanos();
        expect(conHuerfana.ok, "con una huérfana plantada el probe debe ponerse rojo").toBe(false);
        expect(conHuerfana.detalle ?? "").toContain(CLAVE_FANTASMA);

        // Quitarla: el probe deja de nombrarla (no queda rojo-permanente por ESTA clave).
        await prisma.moduloPermisible.delete({ where: { clave: CLAVE_FANTASMA } });
        const despues = await probeModulosHuerfanos();
        expect(despues.detalle ?? "").not.toContain(CLAVE_FANTASMA);
    });

    it("una clave del catálogo plantada NO se marca huérfana (no falso positivo)", async () => {
        // `inicio_admin` está en el catálogo. Si ya existe en la BD, este create
        // fallaría por unique; lo evitamos usando upsert sobre esa clave conocida.
        const existente = await prisma.moduloPermisible.findUnique({ where: { clave: "inicio_admin" } });
        if (!existente) {
            await prisma.moduloPermisible.create({
                data: { clave: "inicio_admin", nombre: "Inicio del administrador", categoria: "admin" },
            });
        }
        const resultado = await probeModulosHuerfanos();
        expect(resultado.detalle ?? "").not.toContain("inicio_admin");
    });
});
