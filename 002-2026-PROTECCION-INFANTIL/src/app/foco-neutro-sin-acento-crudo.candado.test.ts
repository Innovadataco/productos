import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * I-409 (SPEC-662) · CANDADO DE CONDUCTA del FOCO NEUTRO — cierra la clase de verdad.
 *
 * Decisión de Diseño: el indicador de foco es UN contorno de TINTA NEUTRA, igual en
 * toda la app (`.ring-accent:focus-visible` / `.ring-accent-input:focus` → `outline
 * 2px rgb(var(--tinta-rgb))`, ~15.89/18.29; + el fallback nativo de
 * `button/a/[role=button]`). **Ningún elemento declara su foco con el ACENTO crudo.**
 *
 * Invariante (conducta, NO un grep del lexema «pino»): falla si cualquier fuente
 * declara su indicador de foco con un color de acento — `focus:ring-<color>` /
 * `focus:border-<color>` (y sus `focus-visible:` / `/opacidad`). Es GENÉRICO sobre el
 * color: caza `pino`, `cielo`, `ambar`, `accent`, `primary` y **cualquier variante
 * futura**, porque excluye por lista SOLO las utilidades de foco que NO son color
 * (ancho `focus:ring-2`, `focus:ring-offset-*`, `transparent`/`none`/`current`). Un
 * color nuevo cae sin tocar el candado — por eso el enumerado «18» se quedaba corto.
 *
 * SIN base ni lista de archivos: el foco hand-rolled con acento es un defecto en
 * cualquier parte. Con esto en VERDE, el docblock del fallback PUEDE volver a decir
 * «cerrado», porque un archivo nº+1 lo pondría rojo. Muere por mutación: agregar
 * `focus:ring-cielo` a cualquier fuente lo pone ROJO.
 */

const SRC = path.resolve(__dirname, ".."); // .../src
const DIRS = ["components", "app"].map((d) => path.join(SRC, d));

// `focus:`/`focus-visible:` + `ring-`/`border-` + un COLOR (token de diseño o paleta).
// Excluye las utilidades de foco que NO son color: ancho (`-2`), `offset-*`,
// `transparent`/`none`/`current`/`inherit`. Lo que quede empezando por letra es un color.
const FOCO_ACENTO_CRUDO = /\bfocus(?:-visible)?:(?:ring|border)-(?!(?:\d|offset|transparent|current|inherit|none)\b)[a-z]/;

function fuentes(): { rel: string; src: string }[] {
    const out: { rel: string; src: string }[] = [];
    const stack = [...DIRS];
    while (stack.length) {
        const dir = stack.pop()!;
        if (!fs.existsSync(dir)) continue;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const ruta = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (e.name === "node_modules" || e.name === ".next") continue;
                stack.push(ruta);
            } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
                out.push({ rel: path.relative(SRC, ruta), src: fs.readFileSync(ruta, "utf-8") });
            }
        }
    }
    return out;
}

function focosCrudos(rel: string, src: string): string[] {
    const out: string[] = [];
    src.split("\n").forEach((linea, i) => {
        const m = linea.match(FOCO_ACENTO_CRUDO);
        if (m) {
            const frag = linea.trim().slice(0, 90);
            out.push(`${rel}:${i + 1} :: …${frag}…`);
        }
    });
    return out;
}

describe("I-409 · foco neutro: ningún elemento declara su foco con el acento crudo", () => {
    it("el indicador de foco es tinta neutra del sistema, no `focus:ring/border-<acento>`", () => {
        const hits = fuentes().flatMap((f) => focosCrudos(f.rel, f.src));
        expect(
            hits,
            [
                `I-409 — foco con acento crudo (${hits.length}): el foco es UN contorno de tinta neutra, igual en toda la app.`,
                ...hits.map((h) => "  " + h),
                "",
                "Arreglo: inputs/selects → clase `ring-accent-input` (quitando `focus:border-<c>`/",
                "`focus:ring-<c>`); botones/enlaces → quitar el `focus:ring-<c>` (el fallback nativo",
                "`button/a/[role=button]:focus-visible` ya da el contorno de tinta); otros focusables",
                "→ `ring-accent`. El color del foco NUNCA se declara a mano.",
            ].join("\n"),
        ).toEqual([]);
    });
});
