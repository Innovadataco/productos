/**
 * SPEC-352 (hotfix 01-09-2026): guard de `resetDatabase` — jamás truncar una
 * base cuyo nombre no contenga "test". Nacido de la BD dev compartida arrasada
 * dos veces en una madrugada por una suite corrida con el env equivocado.
 */
import { describe, it, expect } from "vitest";
import { validarBdDeTest } from "./test-utils";

describe("validarBdDeTest (SPEC-352 · guard del resetDatabase)", () => {
    it("acepta la base canónica de test", () => {
        expect(() =>
            validarBdDeTest("postgresql://proteccion:x@localhost:5433/proteccion_infantil_test"),
        ).not.toThrow();
    });

    it("acepta variantes con sufijo de shard y query params", () => {
        expect(() =>
            validarBdDeTest("postgresql://u:p@localhost:5433/proteccion_infantil_test3?schema=public"),
        ).not.toThrow();
    });

    it("BLOQUEA la base dev (el caso que arrasó la BD compartida)", () => {
        expect(() =>
            validarBdDeTest("postgresql://proteccion:x@localhost:5433/proteccion_infantil"),
        ).toThrow(/BLOQUEADO/);
    });

    it("BLOQUEA producción y cualquier base sin 'test' en el nombre", () => {
        expect(() =>
            validarBdDeTest("postgresql://u:p@db:5432/proteccion_infantil_prod"),
        ).toThrow(/BLOQUEADO/);
    });

    it("BLOQUEA una URL vacía o ausente", () => {
        expect(() => validarBdDeTest(undefined)).toThrow(/BLOQUEADO/);
        expect(() => validarBdDeTest("")).toThrow(/BLOQUEADO/);
    });
});
