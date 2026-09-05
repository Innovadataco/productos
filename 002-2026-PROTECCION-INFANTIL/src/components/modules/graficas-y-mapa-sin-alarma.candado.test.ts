/**
 * SPEC-455 · «cara» del rediseño: el dashboard público no alarma.
 *
 * Dos candados de conducta (no de palabras), verificables en fuente:
 *  1. Las gráficas compartidas (`DonutChart`, `BarChart`) no traen NINGÚN color
 *     crudo — ni hex, ni clase `slate/sky/cyan/red-*`. Esto vale para TODO el
 *     producto, no solo el dashboard: las dos las usa también la home del colegio.
 *  2. El dashboard público cablea la paleta SIN alarma (`paleta="padre"`), y el
 *     mapa la aplica de verdad a los rellenos y a la leyenda — no solo a los pines.
 *
 * Contraprueba (por mutación, comprobada al escribir el candado):
 *  · devolver un hex a `DonutChart`/`BarChart` → rojo del test 1;
 *  · quitar `paleta="padre"` de `PublicDashboard` → rojo del test 2a;
 *  · volver la leyenda del mapa a `COLORES.alto` → rojo del test 2b.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RAIZ = resolve(__dirname, "..", "..", "..");
const leer = (rel: string) => readFileSync(resolve(RAIZ, rel), "utf-8");

/** Quita comentarios de línea y de bloque para no cazar hex que solo se nombran. */
function sinComentarios(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

// Mismo patrón que `scripts/tokens-check.ts`, más el hex crudo.
const CRUDO =
    /#[0-9a-fA-F]{3,8}\b|\b(?:text|bg|border|ring|from|to|via|divide|outline|placeholder|caret|accent|decoration|stroke|fill|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/g;

describe("SPEC-455 · las gráficas compartidas viven en tokens", () => {
    for (const rel of [
        "src/components/modules/DonutChart.tsx",
        "src/components/modules/BarChart.tsx",
    ]) {
        it(`${rel} no trae ningún color crudo (hex ni escala Tailwind)`, () => {
            const crudos = sinComentarios(leer(rel)).match(CRUDO) ?? [];
            expect(
                crudos,
                `Color crudo en ${rel} — la serie va por token (pino/cielo/ambar + color-mix), ` +
                    `nunca rojo salvo rubi de criticidad. Encontrado: ${crudos.join(", ")}`,
            ).toEqual([]);
        });
    }
});

describe("SPEC-455 · el dashboard público no pinta el rojo de alarma", () => {
    it("`PublicDashboard` le pasa la paleta SIN alarma al mapa", () => {
        const src = sinComentarios(leer("src/components/modules/PublicDashboard.tsx"));
        expect(
            /<MapaUbicaciones[\s\S]*?paleta="padre"[\s\S]*?\/>/.test(src),
            "El dashboard público es abierto: debe pasar `paleta=\"padre\"` (sin rojo) al <MapaUbicaciones>.",
        ).toBe(true);
    });

    it("el mapa aplica la paleta a los rellenos Y a la leyenda, no solo a los pines", () => {
        const src = sinComentarios(leer("src/components/modules/MapaUbicaciones.tsx"));
        // paisStyle y mouseout pasan `paleta` a colorPorCantidad (rellenos del choropleth).
        const rellenosParametrizados = (src.match(/colorPorCantidad\([^)]*paleta[^)]*\)/g) ?? []).length;
        expect(
            rellenosParametrizados,
            "Los rellenos del choropleth deben pasar `paleta` a colorPorCantidad (paisStyle + mouseout).",
        ).toBeGreaterThanOrEqual(2);
        // La leyenda usa la paleta activa (`pal.*`), no la escala de riesgo fija.
        expect(
            /pal\.alto/.test(src) && /pal\.medio/.test(src) && /pal\.bajo/.test(src),
            "La leyenda debe pintar `pal.alto/medio/bajo` (paleta activa), no `COLORES.alto` fijo.",
        ).toBe(true);
        expect(
            /COLORES\.(?:alto|medio|bajo)\b/.test(src),
            "Ningún `COLORES.alto/medio/bajo` fijo: eso reintroduce el rojo de riesgo en la leyenda.",
        ).toBe(false);
    });
});
