/**
 * SPEC-913 · CANDADO de copy del colegio: cierra el residual que el barrido de voz
 * (SPEC-463/523, pronombres + verbal -as/-es/-aste/-iste) NO cubría:
 *
 *   1. «link» en copy VISIBLE → debe decir «enlace» (consistencia léxica, el mismo
 *      cambio de SPEC-909). No toca identificadores (`linkActivacion`), el componente
 *      `<Link>` de Next, ni classNames/hrefs: solo la palabra en minúscula en el copy.
 *   2. Imperativo tú + enclítico (inténtalo, quítalo…) → debe ser usted (inténtelo,
 *      quítelo). El colegio habla de usted (D-107). Esta clase de formas NO colisiona
 *      con sustantivos (a diferencia de los imperativos ambiguos tipo «Selecciona»,
 *      que SPEC-523 difiere al pase visual), así que se caza sin falsos positivos.
 *
 * Muere con el defecto: reinyectar «link» o «Inténtalo» en una pantalla del colegio
 * lo pone en rojo (control positivo abajo). El árbol del PADRE/PÚBLICO NO se toca
 * (ahí la voz es tú, D-107).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "../../.."); // .../src
const DIRS_COLEGIO = [
    path.join(SRC, "components/modules/colegio"),
    path.join(SRC, "app/dashboard/colegio"),
];

function sinComentarios(codigo: string): string {
    return codigo
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function* recorrer(dir: string): Generator<string> {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) yield* recorrer(ruta);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) yield ruta;
    }
}

// «link» como palabra en MINÚSCULA: el componente de Next es `<Link>` (mayúscula) y
// `linkActivacion` es camelCase (sin borde de palabra tras «link») — ninguno cae acá.
const LINK_VISIBLE = /\blink(?:s)?\b/;
// Líneas que legítimamente traen «link» en minúscula y NO son copy: imports
// (`import Link from "next/link"`), clases CSS, URLs/paths. Se excluyen del detector.
const NO_ES_COPY = /className|href|\bsrc=|url\(|\bimport\b|from\s+["']|next\/link/;

// Clase de imperativo tú + enclítico (forma tú = inténtalo; forma usted = inténtelo).
// Son inequívocos (no hay sustantivo homógrafo), por eso se cazan por lista de formas.
const B = "(?<![\\p{L}])";
const E = "(?![\\p{L}])";
const ENCLITICOS_TUTEO = [
    "inténtalo", "inténtala", "intentalo", "intentala",
    "quítalo", "quítala", "quitalo", "quitala",
    "hazlo", "házlo", "míralo", "revísalo", "edítalo", "guárdalo", "créalo",
    "agrégalo", "añádelo", "envíalo", "elígelo", "márcalo", "complétalo", "selecciónalo",
    "llámalo", "contáctalo", "escríbelo", "bórralo", "actívalo", "verifícalo", "cárgalo",
    "anótalo", "asígnalo", "descárgalo", "apruébalo", "recházalo",
    "cuéntanos", "cuéntame", "contáctanos", "avísanos", "escríbenos",
];
const PATRONES_ENCLITICO = ENCLITICOS_TUTEO.map((l) => new RegExp(B + l + E, "iu"));

/** Hits de «link» visible en una línea (ya sin comentarios y que no es marcado). */
function hitsLink(linea: string): boolean {
    if (NO_ES_COPY.test(linea)) return false;
    return LINK_VISIBLE.test(linea);
}
function hitsEnclitico(linea: string): string | null {
    for (const p of PATRONES_ENCLITICO) {
        const m = linea.match(p);
        if (m) return m[0];
    }
    return null;
}

describe("SPEC-913 · copy del colegio: «enlace» (no «link») y usted (no tú enclítico)", () => {
    it("control POSITIVO: los detectores disparan con el defecto y pasan con el fix", () => {
        expect(hitsLink("El comité recibirá un link para activar.")).toBe(true);
        expect(hitsLink("El comité recibirá un enlace para activar.")).toBe(false);
        expect(hitsEnclitico("No pudimos guardar. Inténtalo de nuevo.")).toBe("Inténtalo");
        expect(hitsEnclitico("relación (o quítalo).")).toBe("quítalo");
        expect(hitsEnclitico("No pudimos guardar. Inténtelo de nuevo.")).toBeNull();
        // Sustantivos/adjetivos homógrafos NO son falsos positivos.
        for (const noVoseo of ["estilo", "cielo", "catálogo", "intervalo", "tranquilo", "escala"]) {
            expect(hitsEnclitico(`un ${noVoseo} cualquiera`)).toBeNull();
        }
        // `<Link>` de Next y `linkActivacion` NO son «link» visible.
        expect(hitsLink("<Link href={ruta}>Ver</Link>")).toBe(false);
        expect(hitsLink("const linkActivacion = token;")).toBe(false);
    });

    it("hay árbol que vigilar (el barrido no quedó vacío)", () => {
        const archivos = DIRS_COLEGIO.flatMap((d) => [...recorrer(d)]);
        expect(archivos.length).toBeGreaterThan(30);
    });

    it("ninguna pantalla del colegio trae «link» visible ni imperativo tú enclítico", () => {
        const hits: string[] = [];
        for (const dir of DIRS_COLEGIO) {
            for (const archivo of recorrer(dir)) {
                const codigo = sinComentarios(fs.readFileSync(archivo, "utf-8"));
                for (const [i, linea] of codigo.split("\n").entries()) {
                    if (hitsLink(linea)) {
                        hits.push(`${path.relative(SRC, archivo)}:${i + 1} → «link»: ${linea.trim().slice(0, 90)}`);
                    }
                    const enc = hitsEnclitico(linea);
                    if (enc) {
                        hits.push(`${path.relative(SRC, archivo)}:${i + 1} → «${enc}» (tú enclítico): ${linea.trim().slice(0, 90)}`);
                    }
                }
            }
        }
        expect(
            hits,
            [
                "SPEC-913 — copy del colegio con «link» o imperativo tú enclítico:",
                ...hits,
                "",
                "El colegio dice «enlace» (no «link») y habla de USTED: inténtalo→inténtelo,",
                "quítalo→quítelo. Si la cadena no es mecánica, consultá a Diseño vía CEO.",
            ].join("\n"),
        ).toEqual([]);
    });
});
