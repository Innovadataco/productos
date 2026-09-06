/**
 * SPEC-527 · CANDADO de voseo por CLASE (no lista parcial ad-hoc). Cierra el
 * «falso cero» de 505/512/514: aquellas listas cubrían pocos verbos y el voseo
 * fuera de ellas pasaba. Este candado cubre la CLASE de formas voseo —imperativos
 * -á/-é/-í y presentes -ás/-és/-ís— de forma COMPREHENSIVA, con borde de letra
 * UNICODE `(?<![\p{L}])…(?![\p{L}])/u` (el `\b` ASCII muere en vocal acentuada).
 *
 * Por qué una lista comprehensiva de FORMAS y no un regex de terminación pura:
 * las terminaciones -á/-é/-í/-ás/-és/-ís NO son exclusivas del voseo. En el árbol
 * real conviven con no-voseo que comparte terminación y NO se puede separar por
 * sufijo: adverbios/sustantivos («está», «qué», «más», «aquí», «país», «comité»,
 * «Bogotá», «después»), futuros 3ª/tú («verá», «volverá», «podrás», «serás») y
 * pretéritos de 1ª («encontré», «resolví», «llamé»). Un regex de terminación pura
 * daría decenas de falsos positivos. La lista de FORMAS voseo captura la clase sin
 * ese ruido; se amplía si aparece un verbo nuevo (por eso incluye la familia
 * completa de -ar/-er/-ir frecuentes, no un puñado).
 *
 * Verificado por MUTACIÓN: reponer una de las 5 del mapa (p.ej. «Ajustá») → rojo;
 * y un verbo voseante que NO está en el mapa (p.ej. «tenés») → también rojo. Eso
 * prueba que es clase, no la lista de 5.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..", ".."); // .../src
// Árbol de voz interno + padre + módulos compartidos (el público /registro lo
// cubre SPEC-525). El voseo es defecto en TODA audiencia (§1.9); acá se caza el
// residual de estos árboles.
const DIRS = [path.join(SRC, "app/dashboard"), path.join(SRC, "components/modules")];

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

const B = "(?<![\\p{L}])";
const E = "(?![\\p{L}])";

// Clase de formas voseo, por terminación. Imperativos -á/-é/-í y presentes
// -ás/-és/-ís de los verbos frecuentes del producto + enclíticos rioplatenses.
const LEXEMAS_VOSEO = [
    // presentes -ás / -és / -ís
    "recordás", "querés", "necesitás", "podés", "tenés", "buscás", "elegís",
    "sabés", "vivís", "sentís", "ponés", "hacés", "decís", "llevás", "mandás",
    "entrás", "mirás", "cerrás", "agregás", "salís", "venís", "seguís", "pedís",
    "escribís", "subís", "terminás", "andás", "llegás", "pagás", "cargás",
    "destrabás", "explorás", "probás", "ajustás", "configurás", "refrescás",
    "esperás", "llamás", "reenviás", "previsualizás", "aprobás", "rechazás",
    "enviás", "editás", "revisás", "marcás", "seleccionás", "indicás", "adjuntás",
    "completás", "recibís",
    // subjuntivos voseo
    "terminés", "subás", "elijás", "podás", "querás",
    // imperativos -á / -é / -í
    "elegí", "contá", "volvé", "mirá", "revisá", "marcá", "indicá", "adjuntá",
    "seleccioná", "hacé", "poné", "vení", "entrá", "mandá", "completá", "reenviá",
    "avisá", "subí", "cargá", "pagá", "explorá", "probá", "ajustá", "configurá",
    "refrescá", "esperá", "llamá", "buscá", "decidí", "editá", "previsualizá",
    "aprobá", "rechazá", "enviá", "recibí",
    // enclíticos y otros
    "contanos", "contame", "escribinos", "escribime", "avisanos", "avisame",
    "decinos", "mostranos", "sos",
];
const PATRONES = LEXEMAS_VOSEO.map((l) => new RegExp(B + l + E, "iu"));

describe("SPEC-527 · voseo por clase — cero en dashboard + módulos", () => {
    it("ninguna forma voseo aparece en el árbol (comentarios y tests excluidos)", () => {
        const hits: string[] = [];
        for (const dir of DIRS) {
            for (const archivo of recorrer(dir)) {
                const codigo = sinComentarios(fs.readFileSync(archivo, "utf-8"));
                for (const [i, linea] of codigo.split("\n").entries()) {
                    for (const patron of PATRONES) {
                        const m = linea.match(patron);
                        if (m) hits.push(`${path.relative(SRC, archivo)}:${i + 1} → «${m[0]}»: ${linea.trim().slice(0, 90)}`);
                    }
                }
            }
        }
        expect(
            hits,
            [
                "SPEC-527 — voseo en el árbol dashboard/módulos:",
                ...hits,
                "",
                "El voseo es defecto en TODA audiencia (§1.9). Pase el verbo a usted",
                "(interno) o a tú (padre): Ajustá→Ajuste/Ajusta, tenés→tiene/tienes,",
                "Buscá→Busque/Busca. Si es un verbo nuevo, agréguelo a LEXEMAS_VOSEO.",
            ].join("\n"),
        ).toEqual([]);
    });

    it("contraprueba: las 5 del mapa quedaron sin voseo (usted/tú)", () => {
        const ia = fs.readFileSync(path.join(SRC, "app/dashboard/admin/ia/page.tsx"), "utf-8");
        expect(ia).toContain("Explore, pruebe y ajuste el pipeline");
        const dir = fs.readFileSync(
            path.join(SRC, "components/modules/padre/profesionales/DirectorioProfesionales.tsx"),
            "utf-8",
        );
        expect(dir).toContain("Prueba cambiar la ciudad");
    });
});
