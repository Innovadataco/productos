/**
 * SPEC-479 (fallo de forma de Diseño): PadreSideNav — territorio del padre = cielo,
 * gemelo de SPEC-462 (colegio=pino). El nav NO usa sky crudo: el ítem ACTIVO va en
 * `bg-cielo` (acento del territorio), el INACTIVO va neutro (`text-muted`; el acento
 * cielo se reserva al activo). Candado de fuente, sin BD.
 * Contraprueba (mutación): activo → `bg-sky-600` = rojo (test 1 y 2); inactivo →
 * `text-sky-900/70` = rojo (test 1 y 3).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
    resolve(__dirname, "..", "..", "components/modules/padre/PadreSideNav.tsx"),
    "utf-8",
).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const lineas = src.split("\n");
const activo = lineas.find((l) => /text-white shadow-lg/.test(l)) ?? "";
const inactivo = lineas.find((l) => /hover:bg-cielo\/10|hover:text-cielo/.test(l)) ?? "";

describe("SPEC-479 · PadreSideNav en cielo (0 sky)", () => {
    it("cero sky crudo en el archivo", () => {
        const found = src.match(/\b(?:text|bg|border|ring|from|to|via|shadow|divide)-sky-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/g) ?? [];
        expect(found, `sky crudo en PadreSideNav: ${found.join(", ")}`).toEqual([]);
    });
    it("el ítem ACTIVO va en bg-cielo (acento del territorio padre), no sky", () => {
        expect(activo, "no encontré el ítem activo").not.toBe("");
        expect(/bg-cielo\b/.test(activo), "El activo del nav del padre va en cielo.").toBe(true);
        expect(/-sky-/.test(activo), "El activo no puede usar sky crudo.").toBe(false);
    });
    it("el ítem INACTIVO va neutro (text-muted), acento cielo reservado al activo", () => {
        expect(inactivo, "no encontré el ítem inactivo").not.toBe("");
        expect(/text-muted\b/.test(inactivo), "El inactivo va neutro secundario.").toBe(true);
    });
});
