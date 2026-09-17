/**
 * SPEC-685 · CANDADO — las claves de catálogo que siembran las dos semillas son REALES
 * (existen en el catálogo del repo) y mapean a etiquetas NO vacías. Así la doble escritura
 * (`derivarPerfilCatalogoSeed` → `validarYderivarLegado`) nunca produce tituloProfesional ""
 * ni especialidades []. Verifica el REPO (las constantes + el catálogo default), sin BD.
 *
 * Si alguien edita el catálogo y una clave sembrada deja de existir, o si un dedazo mete una
 * clave inválida, este candado GRITA antes de que la siembra escriba un perfil con etiquetas
 * vacías que Jelkin vería en blanco.
 */
import { describe, it, expect } from "vitest";
import { CLAVES_SEED_RED_APOYO, CLAVES_SEED_E2E_ESTADO, type ClavesPerfilCatalogo } from "./perfil-catalogo-seed";
import {
    PROFESION_DEFAULT,
    AREAS_ATENCION_DEFAULT,
    RANGO_ETARIO_DEFAULT,
    clavesDe,
    clavesDeAreas,
} from "@/lib/profesional/catalogos";

const COHORTES: Array<[string, ClavesPerfilCatalogo]> = [
    ["Red de Apoyo", CLAVES_SEED_RED_APOYO],
    ["E2E por estado", CLAVES_SEED_E2E_ESTADO],
];

const clavesProfesion = clavesDe(PROFESION_DEFAULT);
const clavesAreas = clavesDeAreas(AREAS_ATENCION_DEFAULT);
const clavesRango = clavesDe(RANGO_ETARIO_DEFAULT);
const itemsAreas = AREAS_ATENCION_DEFAULT.flatMap((g) => g.items);

describe("SPEC-685 · claves de siembra ⊆ catálogo, y mapean a etiquetas no vacías", () => {
    for (const [nombre, c] of COHORTES) {
        describe(`cohorte «${nombre}»`, () => {
            it("profesión es una clave real y con etiqueta no vacía", () => {
                expect(c.profesion).not.toBe("");
                expect(clavesProfesion.has(c.profesion)).toBe(true);
                const op = PROFESION_DEFAULT.find((o) => o.clave === c.profesion);
                expect(op?.nombre?.length ?? 0).toBeGreaterThan(0);
            });

            it("áreas: no vacías, todas del catálogo, todas con etiqueta", () => {
                expect(c.areasAtencion.length).toBeGreaterThan(0);
                for (const a of c.areasAtencion) {
                    expect(clavesAreas.has(a)).toBe(true);
                    const op = itemsAreas.find((o) => o.clave === a);
                    expect(op?.nombre?.length ?? 0).toBeGreaterThan(0);
                }
            });

            it("rango etario: no vacío y todo del catálogo", () => {
                expect(c.rangoEtario.length).toBeGreaterThan(0);
                for (const r of c.rangoEtario) expect(clavesRango.has(r)).toBe(true);
            });
        });
    }

    it("CONTROL NEGATIVO · una clave inexistente NO está en el catálogo (el validador discrimina)", () => {
        expect(clavesProfesion.has("no_existe")).toBe(false);
        expect(clavesAreas.has("area_inventada")).toBe(false);
        expect(clavesRango.has("99-100")).toBe(false);
    });
});
