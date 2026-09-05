/**
 * SPEC-492 · afinado de forma de la portada (LandingHero).
 *
 * Conducta, muere por mutación:
 *  - Radio por TOKEN: 0 `rounded-[<literal>]` suelto (se permite `rounded-[var(--…)]`).
 *  - Skeleton, nunca spinner (§4.8): 0 `animate-spin` en el hero.
 *  - Titular fluido (§4.1): usa `titular-estado` (clamp), no `text-4xl/5xl/6xl`.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const src = fs.readFileSync(path.resolve(__dirname, "LandingHero.tsx"), "utf-8");

describe("SPEC-492 · portada: radio por token, skeleton, titular fluido", () => {
    it("radio por token: ningún rounded-[<literal>] suelto (solo rounded-[var(--…)])", () => {
        const sueltos = [...src.matchAll(/rounded-\[([^\]]+)\]/g)].map((m) => m[1]).filter((v) => !v.startsWith("var("));
        expect(sueltos, `radios arbitrarios: ${sueltos.join(", ")}`).toEqual([]);
    });

    it("skeleton, nunca spinner: 0 animate-spin en el hero", () => {
        expect(src).not.toMatch(/animate-spin/);
    });

    it("titular fluido §4.1: usa titular-estado (clamp), no la escala fija text-4xl/5xl/6xl", () => {
        expect(src).toMatch(/titular-estado/);
        expect(src).not.toMatch(/text-(?:4xl|5xl|6xl)/);
    });
});
