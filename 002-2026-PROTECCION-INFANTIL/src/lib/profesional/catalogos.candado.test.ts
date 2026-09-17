/**
 * CANDADO · SPEC-685 · Los catálogos cerrados están bien formados y las semillas
 * siembran EXACTAMENTE lo que el código define.
 *
 * Lo que se guarda en el perfil son las CLAVES; si dos opciones comparten clave, o si
 * la semilla no coincide con la constante, el catálogo miente sobre lo que valida. Este
 * candado fija: claves únicas y no vacías, el núcleo de profesión presente, el rango
 * etario esperado, los helpers de claves, y que `SEMILLAS_CATALOGO_PROFESIONAL` parsea
 * de vuelta a las constantes (el seed no puede divergir del default).
 */
import { describe, it, expect } from "vitest";
import {
    PROFESION_DEFAULT,
    AREAS_ATENCION_DEFAULT,
    RANGO_ETARIO_DEFAULT,
    SEMILLAS_CATALOGO_PROFESIONAL,
    CLAVE_CAT_PROFESION,
    CLAVE_CAT_AREAS,
    CLAVE_CAT_RANGO_ETARIO,
    clavesDe,
    clavesDeAreas,
    type OpcionCatalogo,
} from "./catalogos";

const clavesPlanas = (o: OpcionCatalogo[]) => o.map((x) => x.clave);
const sinDuplicados = (xs: string[]) => new Set(xs).size === xs.length;

describe("SPEC-685 · catálogos cerrados bien formados", () => {
    it("profesión: núcleo psicólogo + psiquiatra, claves únicas y no vacías", () => {
        const claves = clavesPlanas(PROFESION_DEFAULT);
        expect(claves).toContain("psicologo");
        expect(claves).toContain("psiquiatra");
        expect(sinDuplicados(claves)).toBe(true);
        expect(claves.every((c) => c.length > 0)).toBe(true);
        expect(PROFESION_DEFAULT.every((o) => o.nombre.trim().length > 0)).toBe(true);
    });

    it("áreas de atención: 6 grupos, claves únicas GLOBALES, cada grupo con items", () => {
        expect(AREAS_ATENCION_DEFAULT).toHaveLength(6);
        for (const g of AREAS_ATENCION_DEFAULT) {
            expect(g.grupo.trim().length, "grupo sin nombre").toBeGreaterThan(0);
            expect(g.items.length, `grupo «${g.grupo}» sin items`).toBeGreaterThan(0);
        }
        const todas = AREAS_ATENCION_DEFAULT.flatMap((g) => clavesPlanas(g.items));
        // Una clave repetida entre grupos rompería el guardado (es un set de claves).
        expect(sinDuplicados(todas), "clave de área repetida entre grupos").toBe(true);
        expect(todas.length).toBeGreaterThanOrEqual(15); // REPORTE-061: ~15–20
        expect(todas.every((c) => /^[a-z0-9_]+$/.test(c)), "clave con formato raro").toBe(true);
    });

    it("rango etario: las tres bandas de REPORTE-061, únicas", () => {
        expect(clavesPlanas(RANGO_ETARIO_DEFAULT)).toEqual(["0-5", "6-11", "12-17"]);
    });

    it("helpers de claves: aplanan y coinciden con las constantes", () => {
        expect(clavesDe(PROFESION_DEFAULT).has("psicologo")).toBe(true);
        expect(clavesDe(PROFESION_DEFAULT).has("inventada")).toBe(false);
        const areas = clavesDeAreas(AREAS_ATENCION_DEFAULT);
        expect(areas.has("ansiedad")).toBe(true);
        expect(areas.has("acoso_escolar")).toBe(true);
        expect(areas.has("niños")).toBe(false); // «Niños» ya no es un área (REPORTE-061)
    });

    it("las semillas siembran EXACTAMENTE las constantes (el seed no diverge del default)", () => {
        const porClave = new Map(SEMILLAS_CATALOGO_PROFESIONAL.map((s) => [s.clave, s.valor]));
        expect(JSON.parse(porClave.get(CLAVE_CAT_PROFESION)!)).toEqual(PROFESION_DEFAULT);
        expect(JSON.parse(porClave.get(CLAVE_CAT_AREAS)!)).toEqual(AREAS_ATENCION_DEFAULT);
        expect(JSON.parse(porClave.get(CLAVE_CAT_RANGO_ETARIO)!)).toEqual(RANGO_ETARIO_DEFAULT);
    });
});
