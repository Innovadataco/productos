/**
 * SPEC-770 · Prueba de la guardia de base de datos de prueba, en TRES niveles.
 * Afirmar una AUSENCIA («ningún spec escribe sobre prod») exige control positivo:
 * cada nivel prueba las DOS direcciones (con la base equivocada ABORTA, con la
 * correcta pasa), no solo el camino feliz.
 *
 *  · Nivel 1 — predicado PURO `esBaseDeDatosDePrueba`.
 *  · Nivel 2 — la guardia `exigirBaseDeDatosDePrueba` ABORTA (conducta, con un
 *    doble de cliente pasado por parámetro — inyección, no mock del singleton, que
 *    SPEC-174 prohíbe).
 *  · Nivel 3 — el globalSetup que `playwright.config` REALMENTE cablea aborta
 *    end-to-end: se resuelve DESDE la config, se importa y se invoca. Es de
 *    CONDUCTA, no de palabras: si alguien cablea un módulo equivocado o el correcto
 *    con el llamado comentado, el config sigue teniendo el string pero NO aborta,
 *    y este nivel se pone rojo.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import {
    esBaseDeDatosDePrueba,
    exigirBaseDeDatosDePrueba,
    __inyectarNombreConectadoParaTest,
} from "@/lib/e2e/guardia-base-de-datos";

const PROD = "proteccion_infantil"; // el nombre REAL que queremos bloquear
const PRUEBA = "proteccion_infantil_test";

/** Doble mínimo de cliente para el nivel 2 (inyección por parámetro, no mock). */
const clienteFalso = (nombre: string) =>
    ({ $queryRaw: async () => [{ current_database: nombre }] }) as never;

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

afterEach(() => {
    __inyectarNombreConectadoParaTest(null);
});

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

    describe("nivel 2 · la guardia exigirBaseDeDatosDePrueba", () => {
        it("ABORTA contra la base de producción (control positivo)", async () => {
            await expect(exigirBaseDeDatosDePrueba(clienteFalso(PROD))).rejects.toThrow(/NO es de pruebas/i);
        });
        it("NO aborta contra la base de pruebas", async () => {
            await expect(exigirBaseDeDatosDePrueba(clienteFalso(PRUEBA))).resolves.toBeUndefined();
        });
    });

    describe("nivel 3 · el globalSetup CABLEADO en playwright.config (end-to-end)", () => {
        it("ABORTA contra la base de producción (proteccion_infantil)", async () => {
            __inyectarNombreConectadoParaTest(async () => PROD);
            const globalSetup = await globalSetupDeLaConfig();
            await expect((async () => globalSetup({}))()).rejects.toThrow(/NO es de pruebas/i);
        });
        it("NO aborta contra la base de pruebas (control positivo)", async () => {
            __inyectarNombreConectadoParaTest(async () => PRUEBA);
            const globalSetup = await globalSetupDeLaConfig();
            await expect((async () => globalSetup({}))()).resolves.not.toThrow();
        });
    });
});
