/**
 * SPEC-646 (I-381) · CANDADO — la superficie que se invierte en oscuro.
 *
 * Jelkin, en producción y en OSCURO: «no se entiende nada del texto». Causa: una
 * tarjeta pintada con el token de TINTA a baja opacidad (`dark:bg-tinta/N`). En
 * oscuro `--tinta` se vuelve casi blanco, así que ese velo ACLARA la tarjeta (y se
 * apila al anidar); el texto claro (`muted`/`subtle`), calibrado contra `--papel`,
 * colapsa a 1.11:1 (AA pide 4.5). La inversión traicionera: `muted` se lee PEOR que
 * `subtle`, así que «subir el tono» lo empeora.
 *
 * Regla dura (Diseño, autoridad de forma): **la tinta es texto y trazo, NUNCA
 * superficie** — su papel se invierte por tema. Las superficies son `papel` u
 * OPACAS (`bg-superficie-*`); la elevación la da un borde hairline claro, no
 * aclarar el relleno.
 *
 * En vez de MEDIR el apilamiento (un compositor estático no sabe cuán profundo se
 * anida un componente en runtime → puntos ciegos), se hace la clase IMPOSIBLE
 * (ver [[dev-imposibilidad-estructural-mejor-que-regla]]):
 *
 *   (a) CONDUCTA · en el árbol de render de las pantallas del padre que Jelkin toca
 *       (Mis reportes + el expediente) NO existe `dark:bg-tinta/N`: la superficie que
 *       se invierte no se puede escribir ahí.
 *   (b) TOKEN · `text-muted` (el peor de los dos) ≥ 4.5:1 sobre CADA `--superficie-*`,
 *       en LOS DOS temas. Opaco ⇒ una medición por token cubre cualquier anidamiento
 *       (ver [[diseno-candado-contraste-debe-medir-ambos-temas]]).
 *
 * ALCANCE (orden del CEO): este PR arregla el área del padre (reportes/expediente).
 * Colegio, compartido y los sub-árboles de círculo/citas van en PRs siguientes; su
 * `dark:bg-tinta/N` sigue vivo fuera de este árbol y NO lo cubre este candado todavía.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "../../..");
const GLOBALS = path.join(SRC, "app/globals.css");

// Las pantallas del padre que Jelkin recorre y donde vivía el defecto (I-381).
// Se incluyen los LAYOUTS del padre: la barra de navegación móvil (PadreNavMovil)
// vive ahí y sufría el mismo velo invertido (`dark:bg-tinta/95` → barra casi blanca
// en oscuro, en el teléfono), así que también queda bajo el candado.
const RAICES = [
    path.join(SRC, "app/mis-reportes/page.tsx"),
    path.join(SRC, "app/mis-reportes/layout.tsx"),
    path.join(SRC, "app/dashboard/padre/expedientes/[id]/page.tsx"),
    path.join(SRC, "app/dashboard/padre/layout.tsx"),
];

const VELO_INVERTIDO = /dark:bg-tinta\//; // tinta como superficie en oscuro = el bug

// Un enlace/clase COMENTADO no cuenta: se escanea el código SIN comentarios, si no
// esta misma cabecera o un `// dark:bg-tinta/40` daría un falso positivo/negativo.
function sinComentarios(s: string): string {
    return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function resolver(spec: string, desde: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
    else if (spec.startsWith("./") || spec.startsWith("../")) base = path.resolve(path.dirname(desde), spec);
    else return null; // paquete de npm u otra cosa: fuera del árbol propio
    const candidatos = [base, `${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx"), path.join(base, "index.ts")];
    return candidatos.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

/** BFS del árbol de render desde `entrada`, siguiendo solo imports LOCALES. */
function arbolDeRender(entrada: string): Array<{ archivo: string; codigo: string }> {
    const vistos = new Set<string>();
    const cola = [entrada];
    const importRe = /(?:import[\s\S]*?from|import)\s*["']([^"']+)["']/g;
    const salida: Array<{ archivo: string; codigo: string }> = [];
    while (cola.length) {
        const actual = cola.shift()!;
        if (vistos.has(actual) || !fs.existsSync(actual)) continue;
        vistos.add(actual);
        const codigo = fs.readFileSync(actual, "utf-8");
        salida.push({ archivo: actual, codigo });
        for (const m of codigo.matchAll(importRe)) {
            const destino = resolver(m[1]!, actual);
            if (destino && !vistos.has(destino)) cola.push(destino);
        }
    }
    return salida;
}

// ---- (b) medición de contraste ----------------------------------------------
function canalLineal(c: number): number {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminancia([r, g, b]: [number, number, number]): number {
    return 0.2126 * canalLineal(r) + 0.7152 * canalLineal(g) + 0.0722 * canalLineal(b);
}
function contraste(a: [number, number, number], b: [number, number, number]): number {
    const la = luminancia(a);
    const lb = luminancia(b);
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
}

/** Extrae el bloque de un selector (sin llaves anidadas en estos bloques de token). */
function bloqueDe(css: string, selector: string, debeContener: string): string {
    const re = new RegExp(`${selector.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`, "g");
    for (const m of css.matchAll(re)) {
        if (m[1]!.includes(debeContener)) return m[1]!;
    }
    throw new Error(`No encontré el bloque ${selector} con ${debeContener} en globals.css`);
}

function triple(bloque: string, nombre: string): [number, number, number] {
    const m = bloque.match(new RegExp(`--${nombre}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`));
    if (!m) throw new Error(`Falta la variable --${nombre}`);
    return [Number(m[1]), Number(m[2]), Number(m[3])];
}

describe("SPEC-646 (I-381) · (a) la superficie que se invierte no se puede escribir en el árbol del padre", () => {
    for (const raiz of RAICES) {
        it(`existe la raíz ${path.basename(path.dirname(raiz))}/${path.basename(raiz)}`, () => {
            expect(fs.existsSync(raiz), `No encontré ${raiz}`).toBe(true);
        });
    }

    it("ningún archivo del árbol de render (Mis reportes + expediente) usa dark:bg-tinta/N", () => {
        const infractores: string[] = [];
        let totalArchivos = 0;
        for (const raiz of RAICES) {
            for (const { archivo, codigo } of arbolDeRender(raiz)) {
                totalArchivos++;
                if (VELO_INVERTIDO.test(sinComentarios(codigo))) {
                    infractores.push(path.relative(SRC, archivo));
                }
            }
        }
        expect(totalArchivos, "El BFS no recorrió nada — revisá las raíces.").toBeGreaterThan(5);
        expect(
            infractores,
            "Estos archivos del árbol de render del padre pintan una superficie con el velo de TINTA " +
                "que se invierte en oscuro (dark:bg-tinta/N) y aclara la tarjeta hasta romper el texto (I-381). " +
                "La tinta es texto/trazo, nunca superficie: usá `bg-superficie-1|2` (opaco) + borde hairline " +
                "claro (border-tinta) para la elevación. Infractores: " + infractores.join(", ")
        ).toEqual([]);
    });
});

describe("SPEC-646 (I-381) · (b) text-muted ≥ 4.5:1 sobre cada --superficie-* en LOS DOS temas", () => {
    const css = fs.readFileSync(GLOBALS, "utf-8");
    // Bloque claro = el :root que define las superficies; oscuro = .dark.
    const claro = bloqueDe(css, ":root", "--superficie-1-rgb");
    const oscuro = bloqueDe(css, ".dark", "--superficie-1-rgb");

    const temas: Array<{ nombre: string; bloque: string }> = [
        { nombre: "claro", bloque: claro },
        { nombre: "oscuro", bloque: oscuro },
    ];
    const NIVELES = ["superficie-1-rgb", "superficie-2-rgb"];

    for (const { nombre, bloque } of temas) {
        const muted = triple(bloque, "tinta-muted-rgb");
        for (const nivel of NIVELES) {
            it(`tema ${nombre}: text-muted ≥ 4.5:1 sobre --${nivel}`, () => {
                const superficie = triple(bloque, nivel);
                const ratio = contraste(muted, superficie);
                expect(
                    ratio,
                    `muted rgb(${muted}) sobre --${nivel} rgb(${superficie}) da ${ratio.toFixed(2)}:1 (< 4.5) en ${nombre}. ` +
                        "Bajá la superficie (más oscura en oscuro / más clara en claro) hasta cruzar 4.5 con el PEOR token."
                ).toBeGreaterThanOrEqual(4.5);
            });
        }
    }
});
