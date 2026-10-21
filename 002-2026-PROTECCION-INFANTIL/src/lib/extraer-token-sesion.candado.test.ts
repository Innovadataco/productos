/**
 * CANDADO · SPEC-896 (cookie por nombre EXACTO) · extraerTokenSesion.
 *
 * El lector anterior usaba un regex SIN anclar —`/(?:__Host-)?token=([^;]+)/`— que elegía la PRIMERA
 * coincidencia de `token=`: una cookie señuelo (`xtoken=`, `faketoken=`) puesta ANTES de la real era
 * seleccionada (confusión / DoS de auth). Control positivo: con el señuelo delante del `__Host-token`
 * real, el lector exacto devuelve la REAL (con el regex viejo devolvía el señuelo → rojo).
 */
import { describe, it, expect } from "vitest";
import { extraerTokenSesion } from "@/lib/auth";

describe("SPEC-896 · extraerTokenSesion (cookie por nombre exacto)", () => {
    it("ignora un señuelo xtoken= puesto ANTES y toma el __Host-token real", () => {
        // Con el regex viejo esto devolvía "SENUELO" (matcheaba 'token=' dentro de 'xtoken=').
        expect(extraerTokenSesion("xtoken=SENUELO; __Host-token=REAL")).toBe("REAL");
    });

    it("ignora el señuelo en cualquier orden", () => {
        expect(extraerTokenSesion("faketoken=A; token=REAL")).toBe("REAL");
        expect(extraerTokenSesion("__Host-token=REAL; xtoken=B")).toBe("REAL");
    });

    it("__Host-token gana sobre la legacy token (venga en el orden que venga)", () => {
        expect(extraerTokenSesion("token=LEGACY; __Host-token=HOST")).toBe("HOST");
        expect(extraerTokenSesion("__Host-token=HOST; token=LEGACY")).toBe("HOST");
    });

    it("usa la legacy token si no hay __Host-token", () => {
        expect(extraerTokenSesion("token=LEGACY")).toBe("LEGACY");
    });

    it("un señuelo SOLO no entrega ningún token (no se confunde con la real)", () => {
        expect(extraerTokenSesion("xtoken=SENUELO")).toBeUndefined();
        expect(extraerTokenSesion("faketoken=X; othertoken=Y")).toBeUndefined();
    });

    it("sin header → undefined", () => {
        expect(extraerTokenSesion(null)).toBeUndefined();
        expect(extraerTokenSesion("")).toBeUndefined();
    });
});
