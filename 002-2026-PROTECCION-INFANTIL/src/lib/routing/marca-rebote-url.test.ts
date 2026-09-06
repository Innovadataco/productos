/**
 * SPEC-572 (loop-cap · residual de Datos) — `urlSinMarcaRebote` borra SOLO `_rv`, preservando el
 * resto de la query. La condición explícita de Datos: `?foo=1&_rv=1` → `?foo=1`, nunca vaciar la
 * query a ciegas. Y devuelve null cuando no hay marca (nada que reemplazar → no se llama replaceState).
 */
import { describe, it, expect } from "vitest";
import { urlSinMarcaRebote } from "./marca-rebote-url";

const BASE = "https://pi.innovadataco.com";
const MARCA = "_rv";

describe("urlSinMarcaRebote (SPEC-572)", () => {
    it("borra `_rv` PERO preserva el resto de la query", () => {
        expect(urlSinMarcaRebote(`${BASE}/dashboard/padre?foo=1&_rv=1`, MARCA)).toBe("/dashboard/padre?foo=1");
    });

    it("con `_rv` como único parámetro, deja el pathname sin query", () => {
        expect(urlSinMarcaRebote(`${BASE}/dashboard/padre?_rv=1`, MARCA)).toBe("/dashboard/padre");
    });

    it("sin `_rv`, devuelve null (no hay nada que reemplazar)", () => {
        expect(urlSinMarcaRebote(`${BASE}/dashboard/padre?foo=1`, MARCA)).toBeNull();
        expect(urlSinMarcaRebote(`${BASE}/dashboard/padre`, MARCA)).toBeNull();
    });

    it("preserva varios parámetros y el hash, borrando solo `_rv`", () => {
        expect(urlSinMarcaRebote(`${BASE}/x?a=1&_rv=1&b=2#seccion`, MARCA)).toBe("/x?a=1&b=2#seccion");
    });

    it("no confunde un parámetro que solo CONTIENE `_rv` en el nombre", () => {
        // `_rvx` no es la marca: no se toca.
        expect(urlSinMarcaRebote(`${BASE}/x?_rvx=1`, MARCA)).toBeNull();
    });
});
