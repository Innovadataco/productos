/**
 * SPEC-514 · CANDADO DE CLASE de voz: el área INTERNA (admin · operador · comité ·
 * verificador) habla de «usted» — NUNCA voseo (§1.9 del arranque). El voseo es
 * defecto en TODA audiencia; acá se caza en el árbol interno.
 *
 * Es un candado de CLASE, no de caso: detecta el PATRÓN de voseo (lexemas -á/-é/-í
 * e -ás/-és/-ís con borde de letra UNICODE), no una lista de cadenas concretas.
 *
 * Lección heredada (SPEC-501/504): el `\b` de ASCII MUERE contra vocal acentuada,
 * así el candado pasaba CON el defecto. El borde correcto es `(?<![\p{L}])…(?![\p{L}])`
 * con flag `u` — dispara en «Editá», no en «editándolo» (gerundio) ni «edite».
 *
 * Verificado por MUTACIÓN: reponer una cadena voseada en un archivo del área interna
 * (p.ej. «Editá» en configuracion/page.tsx) pone el candado en rojo con archivo:línea.
 *
 * El área del PADRE/PÚBLICO (= «tú») la cubre `voz-tu-padre-publico.candado.test.ts`
 * (SPEC-501); acá NO se re-verifica para no duplicar.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "../../.."); // .../src

// El árbol INTERNO: la superficie admin + los muebles internos compartidos que
// montan sus pantallas. (El padre/público y el profesional tienen sus propios
// candados de área.)
const DIRS_INTERNO = [
    path.join(SRC, "app/dashboard/admin"),
    path.join(SRC, "app/api/admin"),
    path.join(SRC, "components/modules/guias-accion"),
    path.join(SRC, "components/modules/ia"),
    path.join(SRC, "components/modules/notificaciones"),
    path.join(SRC, "components/modules/verificacion"),
];
// El error de reasignación por admin vive en un archivo de dominio profesional
// pero le habla al admin (§C del mapa). Se guarda explícito.
const FILES_INTERNO = [path.join(SRC, "lib/profesional/cita/cita.service.ts")];

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

// Borde de letra Unicode: dispara en la palabra exacta, cierra contra vocal
// acentuada donde el `\b` ASCII falla, y no caza gerundios ni la forma usted.
const B = "(?<![\\p{L}])";
const E = "(?![\\p{L}])";
function vos(lexema: string): RegExp {
    return new RegExp(B + lexema + E, "iu");
}

// Mismos lexemas curados que el candado del padre (SPEC-501): presentes -ás/-és/-ís,
// subjuntivos, imperativos y enclíticos rioplatenses. Si entra uno nuevo, se agrega.
const LEXEMAS_VOSEO = [
    "recordás", "querés", "necesitás", "podés", "tenés", "buscás", "elegís",
    "sabés", "vivís", "sentís", "ponés", "hacés", "decís", "llevás", "mandás",
    "entrás", "mirás", "cerrás", "agregás", "salís", "venís", "seguís", "pedís",
    "escribís", "subís", "terminás", "andás", "llegás", "pagás", "cargás",
    "terminés", "subás", "elijás",
    "elegí", "contá", "volvé", "mirá", "revisá", "marcá", "indicá", "adjuntá",
    "seleccioná", "hacé", "poné", "vení", "entrá", "mandá", "completá", "reenviá",
    "avisá", "subí", "cargá", "pagá", "aprobá", "rechazá", "enviá", "previsualizá",
    "editá",
    "contanos", "contame", "escribinos", "escribime", "avisanos", "avisame",
    "decinos", "mostranos",
    "sos",
];
const PATRONES = LEXEMAS_VOSEO.map(vos);

function* archivosInternos(): Generator<string> {
    for (const dir of DIRS_INTERNO) yield* recorrer(dir);
    for (const f of FILES_INTERNO) if (fs.existsSync(f)) yield f;
}

describe("SPEC-514 · el área interna habla de «usted» (sin voseo)", () => {
    it("ningún lexema de voseo aparece en el árbol interno (comentarios excluidos)", () => {
        const hits: string[] = [];
        for (const archivo of archivosInternos()) {
            const codigo = sinComentarios(fs.readFileSync(archivo, "utf-8"));
            for (const [i, linea] of codigo.split("\n").entries()) {
                for (const patron of PATRONES) {
                    const m = linea.match(patron);
                    if (m) {
                        hits.push(`${path.relative(SRC, archivo)}:${i + 1} → «${m[0]}»: ${linea.trim().slice(0, 90)}`);
                    }
                }
            }
        }
        expect(
            hits,
            [
                "SPEC-514 — voseo en una pantalla del área interna:",
                ...hits,
                "",
                "El área interna (admin/operador/comité/verificador) habla de USTED.",
                "Cambie el verbo a su forma en usted (Editá→Edite, Revisá→Revise,",
                "Hacé→Haga, Elegí→Elija). NUNCA voseo en ninguna audiencia (§1.9).",
            ].join("\n"),
        ).toEqual([]);
    });

    it("contraprueba: el área interna tiene contenido en «usted» (no se vació)", () => {
        // Ancla positiva: si alguien borra el copy para pasar el candado, esto cae.
        const configPage = fs.readFileSync(
            path.join(SRC, "app/dashboard/admin/configuracion/page.tsx"),
            "utf-8",
        );
        expect(configPage.includes("Edite los parámetros")).toBe(true);
        const cita = fs.readFileSync(path.join(SRC, "lib/profesional/cita/cita.service.ts"), "utf-8");
        expect(cita.includes("Elija OTRO profesional para reasignar")).toBe(true);
    });
});
