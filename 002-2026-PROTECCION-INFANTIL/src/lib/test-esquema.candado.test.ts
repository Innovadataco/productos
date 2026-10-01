/**
 * SPEC-817 pieza 2 · CANDADO (puro) de la comparación de esquema: la carpeta de migraciones contra las
 * aplicadas en la base, y el mensaje que DICE «esquema desactualizado» (no un fallo de test ambiguo).
 */
import { describe, it, expect } from "vitest";
import { migracionesFaltantes, mensajeEsquemaDesactualizado } from "./test-esquema";

describe("SPEC-817 pieza 2 · migracionesFaltantes", () => {
    it("al día: todo lo de la carpeta está aplicado → sin faltantes", () => {
        expect(migracionesFaltantes(["a", "b", "c"], ["a", "b"])).toEqual([]);
        expect(migracionesFaltantes(["a", "b"], ["a", "b"])).toEqual([]);
    });

    it("base ATRÁS del repo: la migración de la carpeta que no se aplicó aparece como faltante", () => {
        expect(migracionesFaltantes(["a"], ["a", "b"])).toEqual(["b"]);
        expect(migracionesFaltantes([], ["a", "b"])).toEqual(["a", "b"]);
    });

    it("base ADELANTE (más aplicadas que la carpeta, p.ej. ramas viejas) NO bloquea leer", () => {
        expect(migracionesFaltantes(["a", "b", "zz_vieja"], ["a", "b"])).toEqual([]);
    });
});

describe("SPEC-817 pieza 2 · mensajeEsquemaDesactualizado", () => {
    it("DICE que el problema es el esquema, nombra la base y da la salida accionable", () => {
        const m = mensajeEsquemaDesactualizado(["20260101000000_x"], "proteccion_infantil_pi_825_test");
        expect(m).toMatch(/ESQUEMA DESACTUALIZADO/);
        expect(m).toContain("proteccion_infantil_pi_825_test");
        expect(m).toMatch(/migrate deploy/);
        expect(m).toContain("20260101000000_x");
        // No miente llamándolo defecto del test.
        expect(m).toMatch(/NO es un defecto/i);
    });
});
