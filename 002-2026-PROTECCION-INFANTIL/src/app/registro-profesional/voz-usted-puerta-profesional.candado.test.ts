/**
 * SPEC-559 · CANDADO de voz: la PUERTA del profesional (registro + perfil) habla
 * de «usted» — sin voseo Y sin tuteo. Es la primera impresión de alguien a quien
 * le pediremos atender a menores.
 *
 * Por qué existe además del de 505: el de 505 lista SOLO voseo, y por ese hueco
 * pasó todo el tuteo de la puerta (tú/tu/tus/te + «Iniciá sesión» voseo que
 * ninguna lista tenía). Este vigila la CLASE COMPLETA sobre TODO el árbol de la
 * puerta y se prueba por mutación con una forma NO listada — la condición que
 * distingue un candado de clase de una lista disfrazada.
 *
 * Detector (borde de letra UNICODE `(?<![\p{L}])…(?![\p{L}])/u`):
 *  - VOSEO por MORFOLOGÍA: presentes voseo terminan en `-ás/-és/-ís` (acentuados
 *    y con -s: la 3ª persona nunca los lleva). Es el detector de CLASE: caza
 *    voseo NO listado (p. ej. «mandás»). Se exceptúan las palabras que terminan
 *    igual pero NO son voseo (adverbios/sustantivos: país, después, inglés…);
 *    no son defectos exculpados sino palabras fuera de la clase.
 *  - VOSEO por LEXEMA: los imperativos (`-á/-é/-í`) colisionan con futuros
 *    (llegará) y con «está», así que no se barren por morfología: van por lista
 *    inequívoca (contá, elegí, creá, armás, iniciá…).
 *  - TUTEO por LEXEMA (el `-as/-es` átono lo comparten plurales y sustantivos):
 *    pronombres/posesivos/enclíticos + presentes 2ª singular inequívocos.
 *
 * Alcance = el del mapa: `app/registro-profesional/**` + `app/perfil-profesional/**`.
 * Los mensajes «Completa tu perfil» de `api/profesional` (fuera del árbol) se
 * candan por ANCLA positiva. Verificado por MUTACIÓN en varios sentidos.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..", ".."); // .../src
const DIRS = [path.join(SRC, "app/registro-profesional"), path.join(SRC, "app/perfil-profesional")];

function* recorrer(dir: string): Generator<string> {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) yield* recorrer(ruta);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) yield ruta;
    }
}
function sinComentarios(codigo: string): string {
    return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}
const B = "(?<![\\p{L}])";
const E = "(?![\\p{L}])";
const rx = (l: string) => new RegExp(B + l + E, "iu");

// Voseo por lexema (imperativos + irregulares; la morfología cubre los presentes).
const VOSEO = [
    "elegí", "contá", "contale", "escribí", "indicá", "adjuntá", "revisá", "intentá",
    "reenviá", "mirá", "volvé", "avisá", "completá", "cargá", "creá", "dejá", "dejanos",
    "abrí", "abrilo", "iniciá", "armá", "sos", "andá", "poné", "hacé", "vení", "salí",
];
// Tuteo por lexema (pronombres/posesivos/enclíticos + 2ª singular inequívoca).
const TUTEO = [
    "tú", "tu", "tus", "te", "ti", "tuyo", "tuya", "tuyos", "tuyas", "contigo",
    "tienes", "puedes", "quieres", "debes", "necesitas", "sabes", "ves", "eres",
    "prefieres", "deseas", "vas", "estás",
];
const LEXEMAS = [...VOSEO, ...TUTEO].map(rx);

// CLASE voseo: presente en -ás/-és/-ís (acentuado + s). Excepciones = palabras que
// terminan igual pero no son voseo (fuera de la clase, no defectos exculpados).
const MORFOLOGIA_VOSEO = /(?<![\p{L}])[\p{L}]+(?:ás|és|ís)(?![\p{L}])/giu;
const NO_VOSEO = new Set([
    "país", "después", "inglés", "francés", "interés", "además", "quizás", "jamás",
    "través", "compás", "atrás", "detrás", "demás", "cortés", "revés", "ciprés",
]);

describe("SPEC-559 · la puerta del profesional habla de «usted» (sin voseo ni tuteo)", () => {
    const archivos = [...DIRS].flatMap((d) => [...recorrer(d)]);

    it("anti-falso-verde: el alcance resolvió las páginas de la puerta", () => {
        for (const c of ["registro-profesional/page.tsx", "registro-profesional/crear-clave/[token]/page.tsx", "perfil-profesional/completar/page.tsx"]) {
            expect(archivos.some((a) => a.replace(/\\/g, "/").endsWith(c)), `falta ${c}`).toBe(true);
        }
    });

    it("ni voseo (lexema o morfología) ni tuteo aparecen en el árbol de la puerta", () => {
        const hits: string[] = [];
        for (const archivo of archivos) {
            const codigo = sinComentarios(fs.readFileSync(archivo, "utf-8"));
            for (const [i, linea] of codigo.split("\n").entries()) {
                for (const patron of LEXEMAS) {
                    const m = linea.match(patron);
                    if (m) hits.push(`${path.relative(SRC, archivo)}:${i + 1} → «${m[0]}» (lexema): ${linea.trim().slice(0, 80)}`);
                }
                for (const m of linea.matchAll(MORFOLOGIA_VOSEO)) {
                    if (!NO_VOSEO.has(m[0].toLowerCase())) {
                        hits.push(`${path.relative(SRC, archivo)}:${i + 1} → «${m[0]}» (morfología voseo): ${linea.trim().slice(0, 80)}`);
                    }
                }
            }
        }
        expect(
            hits,
            ["SPEC-559 — voz informal en la puerta del profesional:", ...hits, "",
                "La puerta habla de USTED. Voseo→usted (Iniciá→Inicie, creá→cree), tuteo→usted",
                "(tu→su, te→le/se, Completa→Complete). Si es una palabra no-voseo en -ás/-és/-ís,",
                "agregala a NO_VOSEO."].join("\n"),
        ).toEqual([]);
    });

    it("contraprueba: los mensajes «Completa tu perfil» de api/profesional quedaron en usted", () => {
        const docs = fs.readFileSync(path.join(SRC, "app/api/profesional/documentos/route.ts"), "utf-8");
        const autz = fs.readFileSync(path.join(SRC, "app/api/profesional/autorizacion/route.ts"), "utf-8");
        expect(docs).toContain("Complete su perfil antes de cargar documentos.");
        expect(autz).toContain("Complete su perfil antes de subir la autorización.");
        expect(docs.includes("Completa tu perfil") || autz.includes("Completa tu perfil")).toBe(false);
    });
});
