/**
 * SPEC-571 (I-353) · CANDADO — guardia de autorización a nivel PÁGINA en
 * /dashboard/admin/** y /dashboard/colegio/**.
 *
 * Defensa en profundidad: hoy NO hay fuga de datos (las APIs guardan con
 * verifyAuth/assertModulo + scope), pero un `page.tsx` sin comprobación rinde su
 * CASCARÓN a cualquier autenticado — un OPERADOR veía la consola de rectores,
 * etc. El middleware NO autoriza por rol en runtime y los layouts de dashboard
 * NO redirigen (lo dicen ellos mismos). La única capa que un candado estructural
 * puede exigir es que la página declare SU autorización.
 *
 * REGLA (absoluta, sin lista de páginas): toda `page.tsx` de la superficie debe
 * quedar cubierta por ALGUNO de estos mecanismos, EN LA PÁGINA O EN UN LAYOUT
 * ANCESTRO DE SERVIDOR (una página cliente no puede correr la comprobación ella
 * misma: su única protección posible es un ancestro servidor):
 *
 *   1. verifyAuth(<rol>)                         — guardia por rol.
 *   2. verificarAccesoPagina / puedeAccederAModulo — guardia por módulo (grant en BD).
 *   3. verifyToken + gate (rol o scope) + redirect — guardia bespoke (verifyToken
 *      SOLO no cuenta: exige además una comprobación que redirija; ver LÍMITE).
 *   4. stub de redirect PURO — el export no rinde JSX y solo llama
 *      redirect/permanentRedirect (no hay cascarón que filtrar). Es ESTRUCTURAL:
 *      si el stub crece una pantalla mañana, deja de calificar solo.
 *
 * LÍMITE QUE ESTE CANDADO CONFIESA (no puede distinguir, a propósito):
 *   - Reconoce MECANISMOS, no correctitud semántica: no prueba que el rol/módulo
 *     elegido sea el correcto, ni que el gate bespoke bloquee de verdad — solo
 *     que el mecanismo está presente. El rol/módulo correcto se lee de la API que
 *     la página consume (lo firma Datos), no de este candado.
 *   - El mecanismo 3 exige verifyToken + (rol|scope) + redirect juntos; un
 *     `verifyToken` mudo (token leído sin gate) NO pasa. Pero un gate presente
 *     pero flojo (p. ej. que no cubra todos los roles) sí pasaría: eso lo cubre
 *     la revisión, no el escaneo.
 *   - La guardia comentada no cuenta: se detecta sobre código SIN comentarios.
 *
 * Muere POR PÁGINA (una sin cubrir → rojo) y una página NUEVA sin cubrir nace en
 * rojo: no hay escapatoria ni registro que editar. Provenance: el test imprime
 * de DÓNDE sale la guardia de cada página (propia o heredada, y de cuál layout),
 * porque un «cumple» que no dice por qué es el principio de la próxima mentira.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const DASH = path.resolve(__dirname); // .../src/app/dashboard
const APP = path.resolve(__dirname, ".."); // .../src/app
const SUPERFICIE = ["admin", "colegio"].map((t) => path.join(DASH, t));

// La guardia comentada no es guardia: se detecta sobre código SIN comentarios.
// (El marcador de deuda ya no existe: el candado nació absoluto.)
function sinComentarios(s: string): string {
    return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// 1 y 2: mecanismos canónicos (con argumento real, no `verifyAuth()` pelado).
const CANON = /verifyAuth\s*\(\s*[^)\s]|(?:verificarAccesoPagina|puedeAccederAModulo)\s*\(/;
// 3: bespoke = verifyToken + un gate (rol o scope de sesión) + redirect.
const VTOKEN = /verifyToken\s*\(/;
const REDIR = /(?:permanentRedirect|redirect)\s*\(/;
const GATE = /\brol\b|findSesion|colegioId|comiteColegioId/;
// 4: JSX real (un componente) → si hay, NO es stub puro.
const JSX = /<[A-Za-z]/;

function esClient(code: string): boolean {
    return /^\s*["']use client["']/m.test(code);
}
function guardaCanon(sc: string): boolean {
    return CANON.test(sc);
}
function guardaBespoke(sc: string): boolean {
    return VTOKEN.test(sc) && REDIR.test(sc) && GATE.test(sc);
}
function esStubPuro(sc: string): boolean {
    return REDIR.test(sc) && !JSX.test(sc);
}

function* paginas(dir: string): Generator<string> {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) yield* paginas(ruta);
        else if (e.name === "page.tsx") yield ruta;
    }
}

// Layouts de servidor desde el dir de la página hasta src/app (inclusive).
function layoutsAncestros(pageAbs: string): string[] {
    const out: string[] = [];
    let d = path.dirname(pageAbs);
    for (;;) {
        const lay = path.join(d, "layout.tsx");
        if (fs.existsSync(lay)) out.push(lay);
        if (path.resolve(d) === path.resolve(APP)) break;
        const parent = path.dirname(d);
        if (parent === d) break;
        d = parent;
    }
    return out;
}

interface Resuelto { rel: string; cubierta: boolean; procedencia: string; }

function resolver(pageAbs: string): Resuelto {
    const rel = path.relative(DASH, pageAbs);
    const sc = sinComentarios(fs.readFileSync(pageAbs, "utf-8"));
    if (guardaCanon(sc)) return { rel, cubierta: true, procedencia: "propia · canónica" };
    if (guardaBespoke(sc)) return { rel, cubierta: true, procedencia: "propia · bespoke (verifyToken+gate)" };
    if (esStubPuro(sc)) return { rel, cubierta: true, procedencia: "propia · stub redirect puro" };
    for (const lay of layoutsAncestros(pageAbs)) {
        const lc = fs.readFileSync(lay, "utf-8");
        if (esClient(lc)) continue;
        const lsc = sinComentarios(lc);
        if (guardaCanon(lsc) || guardaBespoke(lsc)) {
            return { rel, cubierta: true, procedencia: `heredada · ${path.relative(DASH, lay)}` };
        }
    }
    return { rel, cubierta: false, procedencia: "SIN GUARDIA" };
}

describe("SPEC-571 · guardia de autorización por página (admin/** y colegio/**)", () => {
    const pags = [...SUPERFICIE.flatMap((d) => [...paginas(d)])].map(resolver);

    it("hay superficie que vigilar (el escaneo no quedó vacío)", () => {
        expect(pags.length).toBeGreaterThan(50);
    });

    it("provenance: de dónde sale la guardia de cada página (visible, no deducida)", () => {
        const heredadas = pags.filter((p) => p.procedencia.startsWith("heredada"));
        const bespoke = pags.filter((p) => p.procedencia.includes("bespoke"));
        const stubs = pags.filter((p) => p.procedencia.includes("stub"));
        console.log(
            `[SPEC-571] superficie ${pags.length} · canónica propia ${pags.filter((p) => p.procedencia === "propia · canónica").length}` +
            ` · bespoke ${bespoke.length} · stub ${stubs.length} · heredada ${heredadas.length}` +
            (heredadas.length ? `\n  heredadas:\n   - ${heredadas.map((p) => `${p.rel} ← ${p.procedencia.replace("heredada · ", "")}`).join("\n   - ")}` : "") +
            (bespoke.length ? `\n  bespoke:\n   - ${bespoke.map((p) => p.rel).join("\n   - ")}` : ""),
        );
        expect(pags.length).toBeGreaterThan(0);
    });

    it("cada página está cubierta por un mecanismo reconocido (en la página o un ancestro)", () => {
        const sinGuardia = pags.filter((p) => !p.cubierta).map((p) => p.rel);
        expect(
            sinGuardia,
            "páginas sin autorización declarada. Cada una necesita UNO de: " +
            "verifyAuth(<rol>) · verificarAccesoPagina(<modulo>) · verifyToken+gate+redirect · stub-redirect-sin-JSX, " +
            "en la página o en un layout ancestro de servidor. Una página cliente va con wrapper de servidor (patrón SPEC-564). " +
            "El rol/módulo se LEE de la API que la página consume, no se adivina por el nombre del directorio.\n" +
            "LÍMITE de este candado: reconoce la PRESENCIA de un mecanismo, NO su correctitud — no prueba que el rol/módulo " +
            "sea el correcto, ni que un gate bespoke bloquee de verdad, ni cubre `verifyAuth()` pelado (sin rol). Eso lo " +
            "firma Datos y lo cubre la revisión, no este escaneo.\n" +
            sinGuardia.join("\n"),
        ).toEqual([]);
    });
});
