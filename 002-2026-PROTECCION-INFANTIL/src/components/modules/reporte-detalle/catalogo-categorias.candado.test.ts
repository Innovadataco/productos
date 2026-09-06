/**
 * SPEC-574 (I-354) · el catálogo de categorías de la UI (`CATEGORIAS`) es la fuente de opciones de
 * «Clasificar» y «Corregir». El endpoint valida contra el enum COMPLETO `CategoriaConducta`, así que
 * un `value` del catálogo que NO exista en el enum daría 400 al enviarlo. Este candado ata la lista
 * paralela al enum para que no se desincronice en esa dirección (stale → 400).
 *
 * NOTA (flagged al CEO): hoy el catálogo es SUBCONJUNTO del enum — faltan CIBERACOSO, HAPPY_SLAPPING
 * y STALKING (SPEC-248, Ley 2564 de 2026). No se agregan acá: su rótulo en español es decisión de
 * Diseño/producto. Cuando se resuelvan, este candado puede endurecerse de ⊆ a = (catálogo == enum).
 */
import { describe, it, expect } from "vitest";
import { CategoriaConducta } from "@prisma/client";
import { CATEGORIAS } from "./types";

describe("SPEC-574 · catálogo de categorías ⊆ enum CategoriaConducta", () => {
    const valoresEnum = new Set<string>(Object.values(CategoriaConducta));

    it("ningún value del catálogo es una categoría inexistente (nada stale que dé 400)", () => {
        const stale = CATEGORIAS.map((c) => c.value).filter((v) => !valoresEnum.has(v));
        expect(
            stale,
            `values del catálogo que NO son CategoriaConducta (darían 400 al clasificar/corregir): ${stale.join(", ")}`,
        ).toEqual([]);
    });

    it("no hay values duplicados en el catálogo", () => {
        const values = CATEGORIAS.map((c) => c.value);
        expect(new Set(values).size, "cada categoría aparece una sola vez").toBe(values.length);
    });
});
