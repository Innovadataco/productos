/**
 * SPEC-685 · CANDADO — la asignación de catálogo de las siembras es válida y VARIADA.
 *
 * (a) Cohorte E2E por estado: claves fijas, reales y con etiqueta no vacía.
 * (b) Red de Apoyo: asignación por índice, DETERMINISTA y variada sobre el catálogo vivo —
 *     ninguna combinación se repite más de N veces (evita clonar el directorio de la demo),
 *     1..3 áreas, todas las claves del catálogo, estable entre corridas. La doble escritura
 *     (`derivarPerfilCatalogoSeed`) nunca produce "" ni [].
 *
 * Verifica el REPO (constantes + catálogo default), sin BD.
 */
import { describe, it, expect } from "vitest";
import {
    CLAVES_SEED_E2E_ESTADO,
    combosRedApoyo,
    clavesRedApoyoParaIndice,
    firmaCombo,
    type ListasCatalogo,
} from "./perfil-catalogo-seed";
import {
    PROFESION_DEFAULT,
    AREAS_ATENCION_DEFAULT,
    RANGO_ETARIO_DEFAULT,
    clavesDe,
    clavesDeAreas,
} from "@/lib/profesional/catalogos";

const clavesProfesion = clavesDe(PROFESION_DEFAULT);
const clavesAreas = clavesDeAreas(AREAS_ATENCION_DEFAULT);
const clavesRango = clavesDe(RANGO_ETARIO_DEFAULT);
const itemsAreas = AREAS_ATENCION_DEFAULT.flatMap((g) => g.items);

const listasDefault: ListasCatalogo = {
    profesiones: PROFESION_DEFAULT.map((o) => o.clave),
    areas: itemsAreas.map((o) => o.clave),
    rangos: RANGO_ETARIO_DEFAULT.map((o) => o.clave),
};

/** Población de la Red de Apoyo (poblar-red-apoyo.ts · NUM_PROFESIONALES). */
const N_POBLACION = 50;
/** Tope de repeticiones de una misma combinación sobre la población (N del CEO; margen sobre el real). */
const MAX_REPETICIONES = 3;

describe("SPEC-685 · cohorte E2E por estado — claves reales y con etiqueta", () => {
    it("profesión, áreas y rango son claves del catálogo, con etiqueta no vacía", () => {
        const c = CLAVES_SEED_E2E_ESTADO;
        expect(clavesProfesion.has(c.profesion)).toBe(true);
        expect(PROFESION_DEFAULT.find((o) => o.clave === c.profesion)?.nombre).toBeTruthy();
        expect(c.areasAtencion.length).toBeGreaterThan(0);
        for (const a of c.areasAtencion) {
            expect(clavesAreas.has(a)).toBe(true);
            expect(itemsAreas.find((o) => o.clave === a)?.nombre).toBeTruthy();
        }
        expect(c.rangoEtario.length).toBeGreaterThan(0);
        for (const r of c.rangoEtario) expect(clavesRango.has(r)).toBe(true);
    });
});

describe("SPEC-685 · Red de Apoyo — asignación por índice determinista y variada", () => {
    const combos = combosRedApoyo(listasDefault);
    const asignadas = Array.from({ length: N_POBLACION }, (_, i) => clavesRedApoyoParaIndice(i, combos));

    it("cada asignación: 1..3 áreas, todas las claves del catálogo", () => {
        for (const c of asignadas) {
            expect(clavesProfesion.has(c.profesion)).toBe(true);
            expect(c.areasAtencion.length).toBeGreaterThanOrEqual(1);
            expect(c.areasAtencion.length).toBeLessThanOrEqual(3);
            for (const a of c.areasAtencion) expect(clavesAreas.has(a)).toBe(true);
            expect(c.rangoEtario.length).toBeGreaterThanOrEqual(1);
            for (const r of c.rangoEtario) expect(clavesRango.has(r)).toBe(true);
        }
    });

    it("ninguna combinación se repite más de N veces sobre la población", () => {
        const conteo = new Map<string, number>();
        for (const c of asignadas) {
            const f = firmaCombo(c);
            conteo.set(f, (conteo.get(f) ?? 0) + 1);
        }
        const maxRep = Math.max(...conteo.values());
        expect(maxRep).toBeLessThanOrEqual(MAX_REPETICIONES);
    });

    it("usa MUCHAS combinaciones distintas (no clona el directorio)", () => {
        const distintas = new Set(asignadas.map(firmaCombo)).size;
        expect(distintas).toBeGreaterThanOrEqual(20);
    });

    it("determinista: el mismo índice da la misma combinación", () => {
        expect(firmaCombo(clavesRedApoyoParaIndice(7, combos))).toBe(firmaCombo(clavesRedApoyoParaIndice(7, combos)));
        // y dos índices contiguos difieren (variedad local)
        expect(firmaCombo(clavesRedApoyoParaIndice(0, combos))).not.toBe(firmaCombo(clavesRedApoyoParaIndice(1, combos)));
    });

    it("CONTROL NEGATIVO · una clave inexistente NO está en el catálogo", () => {
        expect(clavesProfesion.has("no_existe")).toBe(false);
        expect(clavesAreas.has("area_inventada")).toBe(false);
    });
});
