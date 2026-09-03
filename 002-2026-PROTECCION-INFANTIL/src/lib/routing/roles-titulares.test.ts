/**
 * SPEC-416 · Fuente única de dos reglas de rol.
 *
 * Estas afirmaciones parecen triviales pero son el candado exacto que impide
 * lo que I-211 nos enseñó: una regla de rol que vive en 5 lugares se
 * desincroniza en silencio. Acá se afirma la composición desde una posición
 * única — y se documenta la razón de no fusionarlas aunque hoy coincidan.
 */
import { describe, it, expect } from "vitest";
import {
    ROLES_TITULARES_DEL_DATO,
    ROLES_CON_CAMINO_GUIADO,
    esTitularDelDato,
    tieneCaminoGuiado,
} from "./roles-titulares";

describe("SPEC-416 · roles titulares del dato (Ley 1581/2012 · 1918/2018 · 2375/2024)", () => {
    it("PARENT y SCHOOL_ADMIN son titulares — nadie más", () => {
        expect([...ROLES_TITULARES_DEL_DATO].sort()).toEqual(["PARENT", "SCHOOL_ADMIN"]);
    });

    it("esTitularDelDato responde true SOLO para PARENT y SCHOOL_ADMIN", () => {
        expect(esTitularDelDato("PARENT")).toBe(true);
        expect(esTitularDelDato("SCHOOL_ADMIN")).toBe(true);
        for (const rol of ["ADMIN", "OPERADOR", "COMITE_VALIDACION", "COMITE_CONVIVENCIA", "VERIFICADOR", "PROFESIONAL"]) {
            expect(esTitularDelDato(rol), `${rol} no debe ser titular`).toBe(false);
        }
    });

    it("acepta null/undefined como no titular (defensivo)", () => {
        expect(esTitularDelDato(null)).toBe(false);
        expect(esTitularDelDato(undefined)).toBe(false);
        expect(esTitularDelDato("")).toBe(false);
    });
});

describe("SPEC-416 · roles con camino guiado (SPEC-339 · SPEC-344)", () => {
    it("PARENT y SCHOOL_ADMIN tienen camino guiado — nadie más", () => {
        expect([...ROLES_CON_CAMINO_GUIADO].sort()).toEqual(["PARENT", "SCHOOL_ADMIN"]);
    });

    it("tieneCaminoGuiado responde true SOLO para PARENT y SCHOOL_ADMIN", () => {
        expect(tieneCaminoGuiado("PARENT")).toBe(true);
        expect(tieneCaminoGuiado("SCHOOL_ADMIN")).toBe(true);
        for (const rol of ["ADMIN", "OPERADOR", "COMITE_VALIDACION", "COMITE_CONVIVENCIA", "VERIFICADOR", "PROFESIONAL"]) {
            expect(tieneCaminoGuiado(rol), `${rol} no debe tener camino guiado`).toBe(false);
        }
    });
});

describe("SPEC-416 · dos criterios distintos", () => {
    it("hoy coinciden en composición — pero son constantes SEPARADAS, no la misma referencia", () => {
        // Regresión: si alguien "optimiza" fusionándolas en una sola constante,
        // este test falla y le recuerda por qué existen dos.
        expect(ROLES_TITULARES_DEL_DATO).not.toBe(ROLES_CON_CAMINO_GUIADO);
    });
});
