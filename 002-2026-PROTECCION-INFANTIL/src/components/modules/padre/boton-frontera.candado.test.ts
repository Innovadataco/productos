import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * SPEC-633 · CANDADO de la FRONTERA DEL BOTÓN (autoridad: Diseño, doc
 * FRONTERA-BOTON-CUANDO-USAR-BUTTON-2026-09-11). Dos reglas — y el candado
 * CONFIESA su límite (no afirma que el árbol esté limpio):
 *
 *  (a) RATCHET · vigila la APARICIÓN de `<button>` crudo FUERA de `<Button>`
 *      en el árbol del padre. La deuda de hoy está ENUMERADA en `BASE` (archivo
 *      + rótulo) y se paga en la SPEC de seguimiento. La base es una LISTA, no
 *      un número: migrar uno la ACHICA, y un `<button>` nuevo que no esté en la
 *      lista es ROJO aunque el total no suba (un conteo se burlaría migrando uno
 *      y agregando otro). NO cubre `<a>`/`<Link>` de navegación ni las chips de
 *      control segmentado — ésos son otro carril.
 *
 *  (b) ABSOLUTO · un `<Button>` PRIMARIO (sin `variant`, o `variant="primary"`)
 *      dentro de un `.map(` (render repetido) es ROJO. La firma no se reparte
 *      —lo dice `Button.tsx`—. Sin base ni excepciones.
 *
 * Muere por MUTACIÓN: agregar un `<button className="bg-…">` no listado pone (a)
 * rojo; meter `<Button>`/`<Button variant="primary">` dentro de un `.map(` pone
 * (b) rojo. fs + parseo de texto → unit, sin base de datos.
 */

const SRC = path.resolve(__dirname, "..", "..", ".."); // .../src
const DIRS = ["components/modules/padre", "app/dashboard/padre"].map((d) => path.join(SRC, d));

// Archivos que SPEC-647 (#554) borra enteros: no se cuentan como deuda ni se
// migran — se van solos y con ellos sus botones.
const EXCLUIR_647 = [/AvisoRolDesdeGoogle\.tsx$/, /BotonContinuaConGoogle\.tsx$/];

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
                if (EXCLUIR_647.some((re) => re.test(ruta))) continue;
                out.push({ rel: path.relative(SRC, ruta), src: fs.readFileSync(ruta, "utf-8") });
            }
        }
    }
    return out;
}

// Fin de la etiqueta de apertura: el primer '>' a profundidad 0 de llaves y
// fuera de comillas (así `onClick={() => f()}` no confunde con su '>').
function finEtiqueta(src: string, desde: number): number {
    let depth = 0;
    let quote = "";
    for (let j = desde; j < src.length; j++) {
        const c = src[j];
        if (quote) {
            if (c === quote) quote = "";
        } else if (c === '"' || c === "'" || c === "`") quote = c;
        else if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ">" && depth === 0) return j;
    }
    return src.length;
}

// Rótulo normalizado del botón: texto visible + literales de string dentro de
// `{...}`, sin etiquetas hijas. Sirve de ANCLA estable (no cambia al reestilar).
function rotulo(inner: string): string {
    let s = inner.replace(/\{([\s\S]*?)\}/g, (_m, e: string) => {
        const strs = [...e.matchAll(/["'`]([^"'`]*)["'`]/g)].map((m) => m[1]);
        return " " + strs.join(" ") + " ";
    });
    s = s.replace(/<[^>]*>/g, " ");
    return s.replace(/\s+/g, " ").trim();
}

// Todos los `<button>` crudos de un fuente, como "rel :: rótulo".
function botonesCrudos(rel: string, src: string): string[] {
    const out: string[] = [];
    let i = 0;
    while ((i = src.indexOf("<button", i)) !== -1) {
        const fin = finEtiqueta(src, i + 7);
        const cierre = src.indexOf("</button>", fin);
        const inner = cierre === -1 ? "" : src.slice(fin + 1, cierre);
        out.push(`${rel} :: ${rotulo(inner)}`);
        i = cierre === -1 ? fin + 1 : cierre + 9;
    }
    return out;
}

// (b) `<Button>` primario dentro de un `.map(`: devuelve ubicaciones.
function primarioEnMap(rel: string, src: string): string[] {
    const out: string[] = [];
    let i = 0;
    while ((i = src.indexOf(".map(", i)) !== -1) {
        // cuerpo del callback: paréntesis balanceados desde el '(' de .map(
        let j = i + 4; // en '('
        let depth = 0;
        let quote = "";
        const inicio = j;
        do {
            const c = src[j];
            if (quote) {
                if (c === quote) quote = "";
            } else if (c === '"' || c === "'" || c === "`") quote = c;
            else if (c === "(") depth++;
            else if (c === ")") depth--;
            j++;
        } while (j < src.length && depth > 0);
        const cuerpo = src.slice(inicio, j);
        let k = 0;
        while ((k = cuerpo.indexOf("<Button", k)) !== -1) {
            const fin = finEtiqueta(cuerpo, k + 7);
            const attrs = cuerpo.slice(k + 7, fin);
            const mv = attrs.match(/variant\s*=\s*["']([^"']+)["']/);
            const variant = mv ? mv[1] : "primary"; // por defecto es primary
            if (variant === "primary") out.push(`${rel} :: <Button primario en .map>`);
            k = fin + 1;
        }
        i = j;
    }
    return out;
}

/**
 * BASE (a): la DEUDA enumerada — `<button>` crudos que SIGUEN en el árbol del
 * padre tras SPEC-633 y que paga la SPEC de seguimiento. LISTA, no número.
 * Al migrar uno, se BORRA su línea de acá (la base se achica sola).
 */
const BASE: string[] = [
    "components/modules/padre/AgregarEventoForm.tsx :: Cancelar",
    "components/modules/padre/AutoSuggestExpediente.tsx :: Ya se resolvió",
    "components/modules/padre/FormularioAltaHijo.tsx :: ✕",
    "components/modules/padre/HijoCard.tsx :: Inactivar Activar",
    "components/modules/padre/HijoCard.tsx :: Quitar de mi lista",
    "components/modules/padre/HijoCard.tsx :: Ocultar la bitácora Ver la bitácora",
    "components/modules/padre/MisReportesCadenas.tsx :: Ocultar los eventos Ver los eventos",
    "components/modules/padre/PadreSideNav.tsx :: ",
    "components/modules/padre/TextoSensible.tsx :: Ocultar",
    "components/modules/padre/TextoSensible.tsx :: cargando Un momento… 👁 Revelar texto · se ocultó por tu seguridad",
    "components/modules/padre/VerAnalisis.tsx :: Ver análisis",
    "components/modules/padre/profesionales/SolicitarCitaPanel.tsx :: ESTA_SEMANA Esta semana Sin apuro",
    "components/modules/padre/profesionales/SolicitarCitaPanel.tsx :: VIRTUAL Virtual Presencial",
    "components/modules/padre/citas/MisCitasList.tsx :: ` : \"\"}",
    "components/modules/padre/circulo/CirculoConfianzaClient.tsx :: Agregar a alguien Un minuto: nombre, qué es de tus hijos y su celular o usuario.",
    "components/modules/padre/circulo/DetallePersona.tsx :: ",
    "components/modules/padre/circulo/DetallePersona.tsx :: Pausar este dato Reanudar este dato",
    "components/modules/padre/circulo/PanelAgregar.tsx :: ",
    "components/modules/padre/circulo/PanelAgregar.tsx :: ",
    "components/modules/padre/circulo/PanelAgregar.tsx :: Otro",
    "components/modules/padre/circulo/PanelAgregar.tsx :: Quitar",
    "components/modules/padre/circulo/PanelAgregar.tsx :: + Agregar otro dato",
    "components/modules/padre/circulo/PanelAgregar.tsx :: Cancelar",
];

describe("SPEC-633 · frontera del botón: cromo crudo y firma repartida", () => {
    it("(a·ratchet) ningún `<button>` crudo NUEVO fuera de `<Button>` en el árbol del padre", () => {
        const actuales = fuentes().flatMap((f) => botonesCrudos(f.rel, f.src));
        // multiset: lo que está de más respecto de la base = cromo nuevo
        const base = [...BASE];
        const nuevos: string[] = [];
        for (const b of actuales) {
            const idx = base.indexOf(b);
            if (idx === -1) nuevos.push(b);
            else base.splice(idx, 1);
        }
        expect(
            nuevos,
            [
                "SPEC-633 — cromo de botón NUEVO fuera de <Button>:",
                ...nuevos.map((n) => "  " + n),
                "",
                "Este candado NO afirma que el árbol esté limpio: vigila la APARICIÓN",
                "de <button> crudo nuevo. La deuda conocida está en BASE y se paga en",
                "la SPEC de seguimiento. Si tu botón es una acción, usá <Button>; si es",
                "un enlace de texto inline, es otro carril (no aplica).",
            ].join("\n"),
        ).toEqual([]);
    });

    it("(b·absoluto) ningún `<Button>` primario dentro de un `.map(` (la firma no se reparte)", () => {
        const hits = fuentes().flatMap((f) => primarioEnMap(f.rel, f.src));
        expect(
            hits,
            ["SPEC-633 — primario con firma en render repetido (.map):", ...hits.map((h) => "  " + h),
                "", "El sólido con firma es ≤1 por vista/modal y NUNCA por ítem. Usá",
                "variant=\"secondary\"/\"ghost\" en lo que se repite."].join("\n"),
        ).toEqual([]);
    });
});
