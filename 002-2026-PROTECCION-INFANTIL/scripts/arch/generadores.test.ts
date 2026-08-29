/**
 * SPEC-126 (T009 + T015): determinismo y frescura de los 5 artefactos generados.
 * - Doble corrida idéntica (sin timestamps ni rutas absolutas de máquina).
 * - Lo commiteado en docs/architecture/ == la regeneración (misma verificación (a)
 *   del gate, como test local). Si falla: regenerar y commitear en el mismo PR.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { ARTEFACTOS } from "./artefactos";
import { generarIndice } from "./generar-indice";
import { generarModeloDatos } from "./generar-modelo-datos";
import { generarRolesCapacidades } from "./generar-roles-capacidades";
import { generarPantallas } from "./generar-pantallas";
import { generarStack } from "./generar-stack";
import { RUTA_DOCS_ARCH } from "./lib/paths";

const GENERADORES: Record<string, () => string | Promise<string>> = {
    "00-INDICE.md": generarIndice,
    "01-modelo-datos.md": generarModeloDatos,
    "02-roles-capacidades.md": generarRolesCapacidades,
    "03-pantallas.md": generarPantallas,
    "06-stack.md": generarStack,
};

describe("generadores de la línea base (SPEC-126)", { timeout: 300_000 }, () => {
    it("la lista declarativa cubre los 5 artefactos con generador propio", () => {
        expect(ARTEFACTOS.map((a) => a.archivo).sort()).toEqual(Object.keys(GENERADORES).sort());
    });

    it("determinismo: generar dos veces produce salida idéntica byte a byte", async () => {
        for (const [archivo, generar] of Object.entries(GENERADORES)) {
            const primera = await generar();
            const segunda = await generar();
            expect(segunda, `${archivo} no es determinista`).toBe(primera);
        }
    });

    it("lo commiteado en docs/architecture/ es idéntico a la regeneración (sin drift)", async () => {
        for (const [archivo, generar] of Object.entries(GENERADORES)) {
            const commiteado = fs.readFileSync(path.join(RUTA_DOCS_ARCH, archivo), "utf-8");
            expect(await generar(), `${archivo} tiene drift: regenerar y commitear`).toBe(commiteado);
        }
    });

    it("todo artefacto lleva el encabezado GENERADO y ninguna ruta absoluta de máquina", async () => {
        for (const [archivo, generar] of Object.entries(GENERADORES)) {
            const contenido = await generar();
            expect(contenido.startsWith("> GENERADO por `"), `${archivo} sin encabezado GENERADO`).toBe(true);
            expect(contenido).not.toContain(RUTA_DOCS_ARCH);
            expect(contenido).not.toMatch(/\/Users\/|C:\\\\/);
        }
    });
});
