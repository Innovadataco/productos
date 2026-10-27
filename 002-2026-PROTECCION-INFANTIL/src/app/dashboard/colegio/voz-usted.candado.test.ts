/**
 * SPEC-463 (D-107 · Jelkin) · Candado de voz: el territorio del colegio habla
 * de «usted». El rector es institucional (§2 del Sistema de Diseño) — su copy
 * nunca tutea. La marca inequívoca del tuteo son los pronombres/posesivos de
 * segunda persona (tu, tus, tú, tuyo/a, contigo); los verbos ya se migraron a
 * usted en esta spec y el candado los cubre por añadidura si reaparecen con
 * posesivo.
 *
 * Dos direcciones:
 *  (1) NINGUNA pantalla del colegio (app + components) trae tuteo.
 *  (2) Contraprueba: el PADRE conserva su «tú» — el candado NO lo toca y el
 *      tuteo del padre sigue vivo (su voz es cálida, decisión de Jelkin).
 *
 * Verificado por mutación: reintroducir «tu colegio» en cualquier pantalla del
 * colegio hace caer (1); si alguien "corrige" el padre a usted, cae (2).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "../../..");
const DIRS_COLEGIO = [
    path.join(SRC, "app/dashboard/colegio"),
    path.join(SRC, "components/modules/colegio"),
    // SPEC-720: la copia de dominio del colegio nace también en sus SERVICIOS (mensajes de
    // notificación, textos de pendientes/bitácora). `lib/colegio/**` es subárbol PROPIO del
    // colegio (audiencia rector = usted), así que entra al barrido — el árbol COMPARTIDO
    // `lib/dal/services` NO, porque ahí conviven audiencias (el padre habla de «tú», §1.9).
    path.join(SRC, "lib/colegio"),
];
const DIR_PADRE = path.join(SRC, "app/dashboard/padre");

function sinComentarios(codigo: string): string {
    return codigo
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// SPEC-720 · archivos de `lib/colegio` de audiencia MIXTA: no se escanean como usted porque
// contienen también copy del PADRE (tú, §1.9). No es hueco: sus cadenas de COLEGIO están en usted;
// las del padre, en tú, son correctas. `vigencia.ts` decide la vigencia del SCHOOL_ADMIN (usted) y
// del PARENT (`verificarVentanaServicioPadre`, tú) en el mismo archivo — un candado de usted daría
// falso positivo sobre las del padre.
const EXCLUIDOS = new Set([path.join(SRC, "lib/colegio/vigencia.ts")]);

function* recorrer(dir: string): Generator<string> {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) yield* recorrer(ruta);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !EXCLUIDOS.has(ruta)) yield ruta;
    }
}

// Pronombres y posesivos de segunda persona «tú». `\b` ASCII no rompe con «tú»
// (la í/ú acentuada); usamos alternativas explícitas con y sin acento.
const TUTEO = /\b(tu|tus|tú|tuyo|tuya|tuyos|tuyas|contigo)\b/i;

describe("SPEC-463 · el colegio habla de usted (sin tuteo)", () => {
    it("ninguna pantalla del colegio trae tu/tus/tú/tuyo/contigo", () => {
        const hits: string[] = [];
        for (const dir of DIRS_COLEGIO) {
            for (const archivo of recorrer(dir)) {
                const codigo = sinComentarios(fs.readFileSync(archivo, "utf-8"));
                for (const [i, linea] of codigo.split("\n").entries()) {
                    const m = linea.match(TUTEO);
                    if (m) {
                        const rel = path.relative(SRC, archivo);
                        hits.push(`${rel}:${i + 1} → «${m[0]}»: ${linea.trim().slice(0, 90)}`);
                    }
                }
            }
        }
        expect(
            hits,
            [
                "SPEC-463 (D-107) — tuteo en una pantalla del colegio:",
                ...hits,
                "",
                "El rector habla de USTED. Cambie tu→su, tus→sus, y el verbo a su",
                "forma en usted. Si es un identificador legítimo (no debería), agregue",
                "una excepción explícita.",
            ].join("\n"),
        ).toEqual([]);
    });

    it("contraprueba: el PADRE conserva su «tú» (no se le toca la voz)", () => {
        let tuteoDelPadre = 0;
        for (const archivo of recorrer(DIR_PADRE)) {
            const codigo = sinComentarios(fs.readFileSync(archivo, "utf-8"));
            if (TUTEO.test(codigo)) tuteoDelPadre++;
        }
        // El área del padre DEBE seguir tuteando en al menos una pantalla; si
        // este número cae a 0, alguien migró al padre a usted por error.
        expect(tuteoDelPadre).toBeGreaterThan(0);
    });
});

// SPEC-523 · CANDADO DE CLASE: el colegio + comité de convivencia hablan de
// «usted» — no basta con los pronombres (SPEC-463), el tuteo se cuela por las
// FORMAS VERBALES («tienes», «puedes», «hiciste»). Se cazan las inequívocas
// (presentes -as/-es de 2ª persona y pretéritos -aste/-iste) con borde de letra
// UNICODE (el `\b` ASCII muere en vocal acentuada). Los imperativos ambiguos con
// 3ª persona (Selecciona/Asigna/Anota) NO se barren a ciegas (el mapa los difiere
// al pase visual); las 2 líneas puramente imperativas que SÍ tocó SPEC-523 se
// candan por ancla positiva.
//
// Verificado por MUTACIÓN: reponer «tienes/puedes/hiciste» en una pantalla del
// colegio → rojo con archivo:línea; revertir «Seleccione tipo»/«Asigne» → cae el ancla.
const B_U = "(?<![\\p{L}])";
const E_U = "(?![\\p{L}])";
// Presentes de tuteo INEQUÍVOCOS (2ª persona -as/-es), no colisionan con 3ª persona.
const LEXEMAS_TUTEO_VERBAL = [
    "tienes", "puedes", "quieres", "debes", "necesitas", "sabes", "prefieres",
    "eliges", "escribes", "guardas", "agregas", "editas", "creas", "completas",
    "vives", "sientes", "seleccionas", "asignas", "resuelves", "anotas",
];
const PATRONES_TUTEO = LEXEMAS_TUTEO_VERBAL.map((l) => new RegExp(B_U + l + E_U, "iu"));

// SPEC-720 · los PRETÉRITOS de 2ª persona (-aste/-iste) se cazan por MORFOLOGÍA, no por lista
// (la clase que construyó SPEC-719): así `marcaste`, `gestionaste` y cualquier otro quedan
// cubiertos sin editar el candado. La 3ª de usted nunca termina así (marcó/gestionó). Ancla de
// homógrafos válidos en usted/3ª y sustantivos; los identificadores camelCase se descartan por
// su mayúscula interna.
const PRETERITO_2A = /(?<![\p{L}])(\p{L}*(?:aste|iste))(?![\p{L}])/giu;
const PRETERITO_EXCEPCIONES = new Set(
    [
        "existe", "coexiste", "preexiste", "subsiste", "insiste", "consiste",
        "persiste", "resiste", "asiste", "desiste", "embiste", "reviste", "inviste",
        "contraste", "desgaste", "engaste", "gaste", "traste",
        "triste", "chiste", "batiste", "alpiste", "viste", "paste",
    ].map((w) => w.toLowerCase()),
);
function esPreteritoTuteo(palabra: string): boolean {
    if (/\p{Lu}/u.test(palabra.slice(1))) return false; // mayúscula interna → identificador
    return !PRETERITO_EXCEPCIONES.has(palabra.toLowerCase());
}

describe("SPEC-523 · el colegio + comité hablan de «usted» (sin tuteo verbal)", () => {
    it("ninguna forma verbal de tuteo aparece en el árbol del colegio", () => {
        const hits: string[] = [];
        for (const dir of DIRS_COLEGIO) {
            for (const archivo of recorrer(dir)) {
                const codigo = sinComentarios(fs.readFileSync(archivo, "utf-8"));
                for (const [i, linea] of codigo.split("\n").entries()) {
                    for (const patron of PATRONES_TUTEO) {
                        const m = linea.match(patron);
                        if (m) hits.push(`${path.relative(SRC, archivo)}:${i + 1} → «${m[0]}»: ${linea.trim().slice(0, 90)}`);
                    }
                    // SPEC-720 · pretéritos de 2ª persona por morfología (-aste/-iste).
                    for (const m of linea.matchAll(PRETERITO_2A)) {
                        if (esPreteritoTuteo(m[1])) hits.push(`${path.relative(SRC, archivo)}:${i + 1} → «${m[1]}» (pretérito 2ª): ${linea.trim().slice(0, 90)}`);
                    }
                }
            }
        }
        expect(
            hits,
            [
                "SPEC-523 — tuteo verbal en una pantalla del colegio/comité:",
                ...hits,
                "",
                "El colegio y el comité hablan de USTED. Pase el verbo a usted",
                "(tienes→tiene, puedes→puede, hiciste→hizo, Anota→Anote).",
            ].join("\n"),
        ).toEqual([]);
    });

    it("contraprueba: los imperativos ambiguos que tocó SPEC-523 quedaron en «usted»", () => {
        // SPEC-910: el hook `useTipoDocumentoOpciones` (con el placeholder «Seleccione tipo»)
        // se extrajo de TablaEstudiantes a su propio módulo para reusarlo en el modal de alta;
        // el ancla sigue al archivo movido (sigue siendo subárbol del colegio = usted).
        const hookTipos = fs.readFileSync(
            path.join(SRC, "components/modules/colegio/unificado/useTipoDocumentoOpciones.ts"),
            "utf-8",
        );
        expect(hookTipos.includes("Seleccione tipo")).toBe(true);
        const materias = fs.readFileSync(
            path.join(SRC, "components/modules/colegio/curso/SeccionMateriasCurso.tsx"),
            "utf-8",
        );
        expect(materias.includes("Asigne la primera")).toBe(true);
    });
});

// SPEC-915 · CANDADO DE CLASE (cierra el gap que SPEC-523 dejó anotado en su cabecera):
// el IMPERATIVO 2ª-sing SUELTO del tuteo («Elige uno», «Selecciona grado», «Consulta el
// estado») en el árbol del colegio/comité debe ser usted («Elija», «Seleccione»,
// «Consulte»). SPEC-523 lo difirió al pase visual porque el imperativo tú es homógrafo de
// la 3ª-persona indicativa y de sustantivos/adjetivos (la consulta, la carga, materia Activa);
// SPEC-913 solo cazó los enclíticos (inténtalo) y «link», no la forma suelta. Acá se cierra
// por MORFOLOGÍA, no por lista de superficies:
//
//   imperativo tú  =  presente de 2ª persona (la marca de tuteo de SPEC-523)  −  «s» final
//                     seleccionas→selecciona · eliges→elige · escribes→escribe
//
// y se desambigua del homógrafo con dos guardas: (a) POSICIÓN de instrucción — arranque de
// cadena/oración (inicio de línea, o tras `. ¿ ¡ ( « : > " '`) — y (b) OBJETO — seguido de
// otra palabra, lo que descarta el adjetivo suelto «Activa»/«Inactiva» del badge de estado.
// Los sustantivos homógrafos en arranque de oración (p. ej. «Consulta pública») se listan en
// EXCEPCIONES_SUSTANTIVO. Verificado por MUTACIÓN: revertir «Elija uno»→«Elige uno» cae rojo.

// Presente de 2ª persona de los verbos de INSTRUCCIÓN que aparecen como imperativo en la UI
// del colegio (superconjunto instruccional de LEXEMAS_TUTEO_VERBAL). El imperativo tú se
// deriva quitando la «s» — no se enumeran las superficies imperativas.
const PRESENTE_2A_INSTRUCCIONAL = [
    "seleccionas", "eliges", "escribes", "ingresas", "revisas", "creas",
    "agregas", "añades", "completas", "verificas", "cargas", "subes",
    "buscas", "filtras", "asignas", "guardas", "editas", "intentas",
    "contactas", "anotas", "activas", "desactivas", "consultas", "indicas",
    "usas", "documentas", "resuelves", "apruebas", "rechazas", "marcas",
    "envías", "descargas", "confirmas", "continúas", "empiezas",
];
const IMPERATIVO_TU_SUELTO = PRESENTE_2A_INSTRUCCIONAL.map((p) => p.slice(0, -1));

// Arranque de instrucción: inicio de línea o tras terminador/apertura. NO consume letras,
// así que nunca parte un identificador o una palabra mayor.
const ARRANQUE = "(?:^|[>\"'`.¿¡(«:–—])";
// Objeto que sigue al imperativo (otra palabra o apertura «/¿): descarta el adjetivo suelto.
const SEGUIDO_DE_OBJETO = "(?=\\s+[\\p{L}«¿])";
const DETECTOR_IMPERATIVO = new RegExp(
    `(${ARRANQUE})\\s*(${IMPERATIVO_TU_SUELTO.join("|")})${SEGUIDO_DE_OBJETO}`,
    "giu",
);

// Sustantivos/adjetivos homógrafos que legítimamente arrancan oración seguidos de palabra
// (no son imperativos). Clave = forma + primera palabra siguiente, en minúsculas.
const EXCEPCIONES_SUSTANTIVO = new Set<string>([
    // (se puebla si el barrido descubre un sustantivo en arranque de oración; p. ej. "consulta pública")
]);

// Token legítimo (Mayúscula inicial opcional + minúsculas): descarta ENUM en mayúsculas
// («ACTIVA») e identificadores camelCase.
const TOKEN_LIMPIO = /^\p{Lu}?\p{Ll}+$/u;

function hitsImperativoSuelto(linea: string): string[] {
    const encontrados: string[] = [];
    for (const m of linea.matchAll(DETECTOR_IMPERATIVO)) {
        const token = m[2];
        if (!TOKEN_LIMPIO.test(token)) continue;
        const resto = linea.slice((m.index ?? 0) + m[0].length).trimStart();
        const siguiente = resto.split(/\s+/)[0]?.toLowerCase().replace(/[.,:;»)]+$/, "") ?? "";
        if (EXCEPCIONES_SUSTANTIVO.has(`${token.toLowerCase()} ${siguiente}`)) continue;
        encontrados.push(token);
    }
    return encontrados;
}

describe("SPEC-915 · el colegio + comité hablan de «usted» (imperativo suelto)", () => {
    it("control POSITIVO: el detector dispara con el defecto y pasa con el fix", () => {
        expect(hitsImperativoSuelto("a cargo. Elige uno para poder asignarla.")).toEqual(["Elige"]);
        expect(hitsImperativoSuelto("a cargo. Elija uno para poder asignarla.")).toEqual([]);
        expect(hitsImperativoSuelto('label: "Selecciona grado (opcional)"')).toEqual(["Selecciona"]);
        expect(hitsImperativoSuelto('label: "Seleccione grado (opcional)"')).toEqual([]);
        expect(hitsImperativoSuelto('"Consulta el estado de los casos"')).toEqual(["Consulta"]);
        expect(hitsImperativoSuelto('description="Usa «Agregar profesor» para…"')).toEqual(["Usa"]);
        // El adjetivo suelto del badge de estado NO es imperativo (no lleva objeto).
        expect(hitsImperativoSuelto('materia.estado === "activo" ? "Activa" : "Inactiva"')).toEqual([]);
        // Sustantivo con artículo / 3ª-persona NO arrancan oración → no disparan.
        expect(hitsImperativoSuelto("solo la última consulta pinta resultados")).toEqual([]);
        expect(hitsImperativoSuelto("el sistema crea la alerta automáticamente")).toEqual([]);
        // ENUM en mayúsculas e identificador camelCase quedan fuera.
        expect(hitsImperativoSuelto('suscripcion.estado === "ACTIVA"')).toEqual([]);
        expect(hitsImperativoSuelto("const [consulta, setConsulta] = useState()")).toEqual([]);
    });

    it("ningún imperativo tú SUELTO queda en el árbol del colegio/comité", () => {
        const hits: string[] = [];
        for (const dir of DIRS_COLEGIO) {
            for (const archivo of recorrer(dir)) {
                const codigo = sinComentarios(fs.readFileSync(archivo, "utf-8"));
                for (const [i, linea] of codigo.split("\n").entries()) {
                    for (const token of hitsImperativoSuelto(linea)) {
                        hits.push(`${path.relative(SRC, archivo)}:${i + 1} → «${token}»: ${linea.trim().slice(0, 90)}`);
                    }
                }
            }
        }
        expect(
            hits,
            [
                "SPEC-915 — imperativo tú SUELTO en una pantalla del colegio/comité:",
                ...hits,
                "",
                "El colegio y el comité hablan de USTED. Pase el imperativo a usted",
                "(elige→elija, selecciona→seleccione, consulta→consulte, usa→use,",
                "crea→cree, agrega→agregue, completa→complete). Si es un sustantivo en",
                "arranque de oración (no un imperativo), decláralo en EXCEPCIONES_SUSTANTIVO.",
            ].join("\n"),
        ).toEqual([]);
    });
});
