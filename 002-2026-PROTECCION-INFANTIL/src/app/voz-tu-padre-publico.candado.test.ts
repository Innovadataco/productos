/**
 * SPEC-501 (radicado CEO · orden de Jelkin) · Candado de voz: el territorio del
 * PADRE y lo PÚBLICO habla de «tú», SIN voseo. §1.9 del arranque:
 * «padre y público = tú · colegio e interno = usted · nunca voseo».
 *
 * Dos lecciones duras heredadas, cada una cablea una parte de este candado:
 *
 *  (1) Un candado que escanea el DIRECTORIO de la ruta pasa en verde con el
 *      defecto puesto: la pantalla se arma desde components/ fuera de ese
 *      subárbol. El `/reportar` público monta `ReporteWizard`/`FechaHoraIncidente`
 *      desde `components/modules/*.tsx`, NO bajo `padre/`. Por eso resolvemos el
 *      ÁRBOL DE RENDER por BFS transitivo siguiendo los imports `@/…`/relativos
 *      desde las páginas Y los layouts (el chrome envuelve la página), con set de
 *      visitados. Mismo resolver probado en `publicas-auth-sin-crudo.candado`.
 *
 *  (2) La marca del voseo es MORFOLÓGICA y ambigua con conjugaciones neutras y
 *      con el gerundio; una regex `-[aá]s`/`\b` ASCII da falsos positivos
 *      («revisándolo» = gerundio, «hace» = temporal, «Completa» = tú correcto) y
 *      falsos negativos (el `\b` ASCII no cierra contra vocal acentuada). Por eso
 *      el detector es una LISTA CURADA de lexemas de voseo EXACTOS, con borde de
 *      letra Unicode `(?<![\p{L}])…(?![\p{L}])` — dispara en «Elegí», no en
 *      «revisándolo» ni en «yo elegiría». Verificado empíricamente antes de fijar.
 *
 * Verificado por MUTACIÓN: reintroducir cualquier forma de voseo (p.ej. «Elegí»)
 * en un archivo del árbol pone el candado en rojo. Un candado que pasa con el
 * defecto es peor que ninguno.
 *
 * RESUELTO (SPEC-506 · decisión de Jelkin, §D del barrido de Diseño):
 * `PreferenciasNotificaciones.tsx` es MIXTA (la ven padre + profesional + admin).
 * La voz del CUERPO ahora va por AUDIENCIA (§1.9): padre = «tú» (sin voseo) ·
 * colegio/profesional/admin = «usted». Se quitó su voseo («querés»→«quieres») y
 * su exclusión: el archivo entra al barrido de voseo como cualquier otro.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, ".."); // .../src
const APP = path.join(SRC, "app");

/** Todos los `page.tsx` bajo un directorio (deriva el set, no lista a mano). */
function paginas(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
        if (!fs.existsSync(d)) return;
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (e.name === "page.tsx") out.push(p);
        }
    };
    walk(dir);
    return out;
}

// Raíces = páginas de audiencia PADRE + PÚBLICO, más su cadena de layouts (el
// chrome las envuelve). Se derivan por glob para que una página nueva del padre
// entre sola al barrido (una lista a mano reproduce el gap).
const RAICES = [
    // Público
    path.join(APP, "page.tsx"), // portada
    path.join(APP, "layout.tsx"), // root layout (chrome)
    ...paginas(path.join(APP, "reportar")),
    path.join(APP, "reportar", "layout.tsx"),
    ...paginas(path.join(APP, "recuperar")),
    ...paginas(path.join(APP, "seguimiento")),
    // Padre (con sesión)
    path.join(APP, "dashboard", "layout.tsx"),
    path.join(APP, "dashboard", "padre", "layout.tsx"),
    ...paginas(path.join(APP, "dashboard", "padre")),
];

// data-viz (color = valor, lo define Diseño) y tests.
const EXCLUYE = /Sparkline\.tsx$|\.test\.tsx?$/;

function resolver(spec: string, desde: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
    else if (spec.startsWith(".")) base = path.resolve(path.dirname(desde), spec);
    else return null;
    for (const c of [base + ".tsx", base + ".ts", path.join(base, "index.tsx"), path.join(base, "index.ts")]) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
    return fs.existsSync(base) && fs.statSync(base).isFile() ? base : null;
}

/** BFS transitivo del árbol de render bajo src/, con visitados. */
function arbolDeRender(raices: string[]): Set<string> {
    const visto = new Set<string>();
    const cola = raices.filter((r) => fs.existsSync(r));
    while (cola.length) {
        const archivo = cola.shift()!;
        if (visto.has(archivo)) continue;
        visto.add(archivo);
        const src = fs.readFileSync(archivo, "utf-8");
        for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
            const r = resolver(m[1], archivo);
            if (r && r.startsWith(SRC) && !visto.has(r)) cola.push(r);
        }
    }
    return visto;
}

function sinComentarios(codigo: string): string {
    return codigo
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// Borde de letra Unicode: dispara en la palabra exacta, nunca por subcadena
// (no caza «revisándolo» ni «yo elegiría»), y cierra contra vocal acentuada
// donde el `\b` ASCII falla.
const B = "(?<![\\p{L}])";
const E = "(?![\\p{L}])";
function vos(lexema: string): RegExp {
    return new RegExp(B + lexema + E, "iu");
}

/**
 * Lexemas de voseo EXACTOS y sin ambigüedad. Presentes -ás/-és/-ís (la forma tú
 * es -as/-es/-es), imperativos y enclíticos rioplatenses, y `sos`. Se excluyen a
 * propósito las que colisionan con el pretérito de yo (escribí, salí, pedí…): se
 * cubren por su presente inequívoco (escribís, salís, pedís…). Si mañana entra
 * un lexema nuevo, se agrega acá.
 */
const LEXEMAS_VOSEO = [
    // presentes
    "recordás", "querés", "necesitás", "podés", "tenés", "buscás", "elegís",
    "sabés", "vivís", "sentís", "ponés", "hacés", "decís", "llevás", "mandás",
    "entrás", "mirás", "cerrás", "agregás", "salís", "venís", "seguís", "pedís",
    "escribís", "subís", "terminás", "andás", "llegás", "pagás", "cargás",
    // subjuntivos voseo
    "terminés", "subás", "elijás",
    // imperativos
    "elegí", "contá", "volvé", "mirá", "revisá", "marcá", "indicá", "adjuntá",
    "seleccioná", "hacé", "poné", "vení", "entrá", "mandá", "completá", "reenviá",
    "avisá", "subí", "cargá", "pagá",
    // enclíticos
    "contanos", "contame", "escribinos", "escribime", "avisanos", "avisame",
    "decinos", "mostranos",
    // otros
    "sos",
];
const PATRONES = LEXEMAS_VOSEO.map(vos);

// Nodos que el BFS DEBE alcanzar. Guarda anti-falso-verde: si la resolución se
// rompe y el árbol queda corto, el candado no debe pasar por escanear poco.
const NODOS_CLAVE = [
    "ReporteWizard.tsx", "FechaHoraIncidente.tsx", "EsperaCitaPanel.tsx",
    "SolicitarCitaPanel.tsx", "PresentacionUrgenciaForm.tsx",
    "DirectorioProfesionales.tsx", "ExpedienteVivo.tsx",
];

describe("SPEC-501 · padre + público hablan de «tú» (sin voseo)", () => {
    const arbol = [...arbolDeRender(RAICES)].filter((a) => !EXCLUYE.test(a));

    it("las raíces se resolvieron (portada + reportar + recuperar + seguimiento + padre)", () => {
        const raicesVivas = RAICES.filter((r) => fs.existsSync(r));
        // Portada, root layout, y varias páginas del padre + públicas.
        expect(raicesVivas.length).toBeGreaterThanOrEqual(15);
        expect(paginas(path.join(APP, "dashboard", "padre")).length).toBeGreaterThanOrEqual(10);
    });

    it("el BFS alcanza el árbol de render completo (nodos clave presentes)", () => {
        expect(arbol.length).toBeGreaterThan(100);
        for (const nodo of NODOS_CLAVE) {
            expect(
                arbol.some((a) => a.endsWith(nodo)),
                `el BFS no alcanzó ${nodo} — la resolución de imports se rompió`,
            ).toBe(true);
        }
    });

    it("ningún lexema de voseo aparece en el árbol padre/público (comentarios excluidos)", () => {
        const hits: string[] = [];
        for (const archivo of arbol) {
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
                "SPEC-501 — voseo en una pantalla de padre/público:",
                ...hits,
                "",
                "Padre y público hablan de «tú». Cambie el verbo a su forma en tú",
                "(elegí→elige, querés→quieres, contanos→cuéntanos). Si es un caso",
                "legítimo (identificador, string sin traducir), agregue una excepción",
                "explícita. NO migre a usted: el padre tutea (§1.9).",
            ].join("\n"),
        ).toEqual([]);
    });

    it("contraprueba: el padre CONSERVA su «tú» (no se migró a usted por error)", () => {
        // Si un barrido futuro pasa el padre a usted, este número cae. El padre
        // tutea (§1.9): debe quedar tuteo vivo en su árbol.
        const TUTEO = /(?<![\p{L}])(?:tú|Puedes|puedes|Elige|elige|Cuéntanos|cuéntanos|Escríbenos|escríbenos)(?![\p{L}])/u;
        const conTuteo = arbol.filter((a) => TUTEO.test(sinComentarios(fs.readFileSync(a, "utf-8"))));
        expect(conTuteo.length).toBeGreaterThan(0);
    });
});
