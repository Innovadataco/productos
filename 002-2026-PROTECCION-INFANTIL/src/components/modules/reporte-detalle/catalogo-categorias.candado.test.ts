/**
 * SPEC-574 (I-357) · CANDADO — el mapa canónico `CATEGORIAS_LABELS` (labels.ts) CUBRE el enum
 * `CategoriaConducta`, y el desplegable `CATEGORIAS` DERIVA del mapa (no vuelve a ser lista paralela).
 *
 * Historia (I-357, hallazgo de Diseño): el desplegable de `types.ts` era una lista paralela hardcodeada
 * que se desincronizó del mapa canónico — a la LISTA le faltaban las 3 categorías de la Ley 2564
 * (CIBERACOSO/HAPPY_SLAPPING/STALKING), al MAPA le faltaba SPAM: cada una incompleta de forma distinta.
 * La máquina clasificó 699 reportes en las 3 legales y el humano no podía elegir ninguna. El arreglo
 * bueno fue dejar UNA sola fuente (derivar del mapa) y subir el candado un nivel: acá vigila que
 * `labels.ts` cubra el enum. Así, agregar un valor al enum sin rótulo se pone ROJO en vez de que la
 * categoría desaparezca del desplegable en silencio (mismo patrón que los umbrales del secreto y la
 * capa por tema: dos fuentes para la misma verdad se separan solas).
 */
import { describe, it, expect } from "vitest";
import { CategoriaConducta } from "@prisma/client";
import { CATEGORIAS_LABELS } from "@/lib/labels";
import { CATEGORIAS } from "./types";

describe("SPEC-574 · CATEGORIAS_LABELS ↔ enum CategoriaConducta (fuente única)", () => {
    const valoresEnum = Object.values(CategoriaConducta) as string[];
    const clavesLabels = Object.keys(CATEGORIAS_LABELS);

    it("CUBRE · cada categoría del enum tiene rótulo (agregar un valor al enum sin rótulo = rojo)", () => {
        const sinRotulo = valoresEnum.filter((v) => !(v in CATEGORIAS_LABELS));
        expect(
            sinRotulo,
            `categorías del enum SIN rótulo en src/lib/labels.ts (se caerían del desplegable en silencio): ${sinRotulo.join(", ")}. Agrégueles etiqueta humanizada.`,
        ).toEqual([]);
    });

    it("SIN STALE · ninguna clave del mapa es una categoría inexistente en el enum (nada que dé 400)", () => {
        const bogus = clavesLabels.filter((k) => !valoresEnum.includes(k));
        expect(bogus, `claves de labels.ts que NO existen en el enum: ${bogus.join(", ")}`).toEqual([]);
    });

    it("el desplegable DERIVA del mapa — no vuelve a ser una lista paralela", () => {
        // Si alguien re-hardcodea CATEGORIAS, esto se pone rojo: los values deben ser EXACTAMENTE las
        // claves del mapa canónico, y cada label el rótulo canónico (nada propio que se desincronice).
        expect(CATEGORIAS.map((c) => c.value)).toEqual(clavesLabels);
        for (const { value, label } of CATEGORIAS) {
            expect(label).toBe(CATEGORIAS_LABELS[value]);
        }
    });

    it("no hay values duplicados en el desplegable", () => {
        const values = CATEGORIAS.map((c) => c.value);
        expect(new Set(values).size, "cada categoría aparece una sola vez").toBe(values.length);
    });
});
