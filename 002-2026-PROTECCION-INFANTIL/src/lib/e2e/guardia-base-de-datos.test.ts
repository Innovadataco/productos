/**
 * SPEC-770 · Prueba de la guardia de base de datos de prueba, en cuatro niveles.
 * Afirmar una AUSENCIA («ningún spec escribe sobre prod») exige control positivo:
 * cada nivel de conducta prueba las DOS direcciones (con la base equivocada ABORTA,
 * con la correcta pasa), no solo el camino feliz.
 *
 *  · Nivel 1 — predicado PURO `esBaseDeDatosDePrueba`.
 *  · Nivel 2 — la guardia `exigirBaseDeDatosDePrueba` ABORTA, con el proveedor del
 *    nombre pasado POR PARÁMETRO (no hay seam de módulo que apagar).
 *  · Nivel 3 — el globalSetup que `playwright.config` REALMENTE cablea aborta
 *    end-to-end: se resuelve DESDE la config, se importa y se invoca pasándole el
 *    proveedor por argumento. De CONDUCTA, no de palabras: si alguien cablea un
 *    módulo equivocado o el correcto con el llamado comentado, el config sigue
 *    teniendo el string pero NO aborta, y este nivel se pone rojo.
 *  · Nivel 4 — la guardia NO exporta un interruptor de apagado (sin `export let`,
 *    sin export con nombre de bypass, y con exactamente los dos exports esperados):
 *    si alguien vuelve a agregar un inyector «para un test», este nivel lo caza.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { esBaseDeDatosDePrueba, exigirBaseDeDatosDePrueba } from "@/lib/e2e/guardia-base-de-datos";

const PROD = "proteccion_infantil"; // el nombre REAL que queremos bloquear
const PRUEBA = "proteccion_infantil_test";

/** Resuelve el globalSetup que la config REALMENTE cablea, lo importa y lo devuelve. */
async function globalSetupDeLaConfig(): Promise<(...a: unknown[]) => unknown> {
    const config = (await import("../../../playwright.config")).default;
    const raw = config.globalSetup;
    expect(raw, "playwright.config debe cablear un globalSetup").toBeTruthy();
    const ruta = Array.isArray(raw) ? raw[0] : (raw as string);
    // La ruta de la config es relativa a la raíz del producto (donde vive el config).
    const abs = path.resolve(__dirname, "../../..", ruta);
    const mod = (await import(/* @vite-ignore */ abs)) as { default?: unknown };
    const fn = (mod.default ?? mod) as unknown;
    expect(typeof fn, "el globalSetup cableado debe exportar una función").toBe("function");
    return fn as (...a: unknown[]) => unknown;
}

describe("SPEC-770 · guardia de base de datos de prueba", () => {
    describe("nivel 1 · predicado esBaseDeDatosDePrueba", () => {
        it("RECHAZA el nombre real de producción (proteccion_infantil)", () => {
            expect(esBaseDeDatosDePrueba(PROD)).toBe(false);
        });
        it("acepta la base de pruebas (proteccion_infantil_test)", () => {
            expect(esBaseDeDatosDePrueba(PRUEBA)).toBe(true);
        });
        it("rechaza cualquier nombre que no termine en _test", () => {
            for (const n of ["prod", "proteccion", "test", "proteccion_test_infantil", "  proteccion_infantil  ", ""]) {
                expect(esBaseDeDatosDePrueba(n), `«${n}» no es de pruebas`).toBe(false);
            }
        });
    });

    describe("nivel 2 · la guardia exigirBaseDeDatosDePrueba (proveedor por parámetro)", () => {
        it("ABORTA contra la base de producción (control positivo)", async () => {
            await expect(exigirBaseDeDatosDePrueba(async () => PROD)).rejects.toThrow(/NO es de pruebas/i);
        });
        it("NO aborta contra la base de pruebas", async () => {
            await expect(exigirBaseDeDatosDePrueba(async () => PRUEBA)).resolves.toBeUndefined();
        });
    });

    describe("nivel 3 · el globalSetup CABLEADO en playwright.config (end-to-end)", () => {
        it("ABORTA contra la base de producción (proteccion_infantil)", async () => {
            const globalSetup = await globalSetupDeLaConfig();
            await expect((async () => globalSetup({}, async () => PROD))()).rejects.toThrow(/NO es de pruebas/i);
        });
        it("NO aborta contra la base de pruebas (control positivo)", async () => {
            const globalSetup = await globalSetupDeLaConfig();
            await expect((async () => globalSetup({}, async () => PRUEBA))()).resolves.not.toThrow();
        });
    });

    describe("nivel 4 · la guardia NO exporta interruptor de apagado", () => {
        const fuente = fs.readFileSync(path.resolve(__dirname, "guardia-base-de-datos.ts"), "utf-8");

        it("no exporta estado mutable de módulo (`export let`/`export var`)", () => {
            expect(/export\s+(let|var)\b/.test(fuente), "un `export let/var` sería un switch apagable").toBe(false);
        });

        it("ningún export tiene nombre de inyector/bypass", () => {
            const nombres = [...fuente.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var)\s+([A-Za-z0-9_$]+)/g)].map((m) => m[1]);
            const sospechoso = /inyect|bypass|desactiv|apag|disable|override|seam|switch|mock|fake|stub|__/i;
            for (const n of nombres) {
                expect(sospechoso.test(n), `export sospechoso de bypass: ${n}`).toBe(false);
            }
        });

        it("exporta EXACTAMENTE la superficie esperada (cualquier export nuevo obliga a revisión)", async () => {
            const mod = await import("@/lib/e2e/guardia-base-de-datos");
            expect(Object.keys(mod).sort()).toEqual(["esBaseDeDatosDePrueba", "exigirBaseDeDatosDePrueba"]);
        });
    });
});
