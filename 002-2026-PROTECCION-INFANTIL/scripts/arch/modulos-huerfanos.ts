import * as fs from "node:fs";
import * as path from "node:path";
import { RAIZ_PRODUCTO, relativa } from "./lib/paths";
import allowlistJson from "./modulos-huerfanos-allowlist.json";

/**
 * SPEC-654 · Candado de CLASE: ningún módulo de `src/` NUEVO sin un solo importador de producción.
 *
 * `arch:check` vigila FRONTERAS (quién puede importar a quién) y eso lo hace bien. Pero un archivo que
 * NADIE importa no viola ninguna frontera: simplemente no participa. Es invisible POR CONSTRUCCIÓN, no
 * por un hueco — y el costo ya se cobró tres veces en una jornada (un componente muerto que casi se
 * "arregla", deuda que entra a los ratchets como si fuera superficie viva). Este es un chequeo DISTINTO:
 * construye el grafo de imports de TODO el producto y marca el `src/`-módulo que ningún archivo de
 * producción importa.
 *
 * ALCANCE (declarado, no tapado): detecta MÓDULOS (archivos) huérfanos, NO exports/imports muertos
 * DENTRO de un archivo vivo. De los tres casos que lo motivaron, caza `ExpedienteVivo.tsx` (componente
 * que solo importa su propio test); NO caza `hechosDelExpediente` (export muerto en un archivo vivo) ni
 * el import muerto de `lecturaCapa1` — eso es análisis a nivel de símbolo (ts-prune/knip), otro chequeo.
 *
 * EL MODO DE FALLA ES EL FALSO POSITIVO (marcar vivo como muerto). Lo que lo evita:
 *  - Aristas desde TODO el producto, no solo `src/`: los workers `.mjs`/`.js` importan módulos de `src/`
 *    (a veces con `import("…/x.ts")` dinámico y extensión explícita). Sin ellos, `deriva-semanal.ts` y
 *    `corrida-vencimiento.service.ts` parecían muertos y están vivos.
 *  - RE-EXPORTS cuentan como arista: `export { default } from`, `export * from`. Un detector que sigue
 *    solo `import … from` declara muerto lo que vive detrás de un barrel (esa ceguera ya mordió otro walker).
 *  - Imports dinámicos `import("x")` y side-effect `import "x"` cuentan.
 *  - RAÍCES que el runtime alcanza sin import: entradas de Next (page/route/layout/…), middleware,
 *    instrumentation, `.d.ts`, y los `setupFiles` de vitest.
 *  - SOPORTE DE TESTS (exención documentada, NO deuda): archivos que por diseño solo importan los tests
 *    — `*-test-utils`, `fixtures`/`test-fixtures`, `src/lib/e2e/**`, `src/lib/test-mocks/**`. No entran al
 *    ratchet de deuda; un archivo así que NO importe ni un test igual cae (es deuda, no soporte vivo).
 *
 * LÍMITE DECLARADO (aristas por LITERAL, no por plantilla): las tres expresiones de abajo exigen una
 * cadena con comillas. Un import dinámico armado con PLANTILLA —`import(`./workers/${nombre}.ts`)`— o un
 * `require()` con ruta computada NO se ven como arista, y su módulo destino podría aparecer huérfano
 * estando VIVO (falso positivo). Medido el 2026-09-11: CERO imports con backtick y CERO `require()` con
 * ruta relativa/`@/` en `src/` y `scripts/` — control positivo: el mismo patrón SÍ encuentra los 226
 * `import()` con comillas que existen, así que el cero es real, no un patrón roto. El día que alguien
 * escriba un import con plantilla y el ratchet se ponga rojo sobre un módulo VIVO: el módulo NO es basura
 * — sumá acá el manejo del especificador-plantilla (o exímelo con razón), NUNCA desactives el candado.
 *
 * RATCHET (no muro: un muro rojo el día uno se desactiva): la línea base de huérfanos vive en
 * `modulos-huerfanos-allowlist.json` con motivo y quién. `huerfanosNuevos()` (uno fuera de la lista) y
 * `entradasObsoletas()` (una entrada que ya no es huérfana — se cableó o se borró) ponen rojo. El número
 * SOLO BAJA: se limpia un muerto → se saca de la lista; aparece uno nuevo → o se limpia o se declara con razón.
 */
const IGNORAR_DIR = new Set(["node_modules", ".next", "coverage", "dist", ".git", ".turbo", ".worktrees"]);
const DIR_SRC = "src/";

/** Recorre TODO el producto: fuentes de aristas incluyen `.mjs`/`.cjs`/`.js` (workers), no solo TS. */
function* caminar(dir: string): Generator<string> {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (!IGNORAR_DIR.has(e.name)) yield* caminar(full);
        } else if (/\.(tsx?|mjs|cjs|jsx?)$/.test(e.name)) {
            yield full;
        }
    }
}

/** Quita comentarios para no contar un import citado en un comentario como arista viva. */
function sinComentarios(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Resuelve un especificador (`@/…` o relativo) al `src/`-módulo que apunta, o null si es un paquete de
 * node_modules o no resuelve. Maneja especificadores con extensión explícita (`./x.ts`, `../x.js`→`.ts`),
 * sin extensión (`@/lib/x`→`.ts/.tsx`) y barriles (`@/lib/x`→`x/index.ts`).
 */
function resolver(desde: string, spec: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = path.join(RAIZ_PRODUCTO, "src", spec.slice(2));
    else if (spec.startsWith(".")) base = path.resolve(path.dirname(desde), spec);
    else return null; // paquete de node_modules
    const noext = base.replace(/\.(jsx?|mjs|cjs)$/, "");
    const candidatos = [
        base, // el especificador ya traía extensión (p.ej. "./x.ts")
        noext + ".ts",
        noext + ".tsx",
        path.join(noext, "index.ts"),
        path.join(noext, "index.tsx"),
        base + ".ts",
        base + ".tsx",
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
    ];
    for (const c of candidatos) {
        try {
            if (fs.statSync(c).isFile() && /\.tsx?$/.test(c)) return relativa(c);
        } catch {
            /* no existe, siguiente candidato */
        }
    }
    return null;
}

const RE_FROM = /(?:\bimport\b[^;]*?\bfrom\s*|\bexport\b[^;]*?\bfrom\s*)["']([^"']+)["']/g;
const RE_SIDE = /\bimport\s*["']([^"']+)["']/g;
const RE_DYN = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

const esTest = (r: string) => /\.(test|spec)\.tsx?$/.test(r);

// Raíces que el framework/runtime alcanza SIN que nadie las importe.
const RE_NEXT = /\/(page|layout|route|loading|error|not-found|template|default|global-error|sitemap|robots|manifest|opengraph-image|twitter-image|icon|apple-icon)\.(ts|tsx)$/;
const SETUP_VITEST = new Set(["src/lib/test-setup.ts", "src/lib/test-setup-unit.ts"]); // `setupFiles` de vitest.config*.ts
function esRaiz(r: string): boolean {
    return (
        RE_NEXT.test(r) ||
        /^src\/middleware\.tsx?$/.test(r) ||
        /^src\/instrumentation\.tsx?$/.test(r) ||
        /\.d\.ts$/.test(r) ||
        SETUP_VITEST.has(r)
    );
}

// Soporte de tests: exención DOCUMENTADA (no muda), NO deuda. Cada patrón, su razón.
const RE_SOPORTE_TEST: ReadonlyArray<RegExp> = [
    /(^|\/)[^/]*-test-utils\.tsx?$/, // helpers compartidos de tests (apelacion-test-utils, comite-test-utils, …)
    /(^|\/)test-fixtures\.tsx?$/, // fixtures de tests de compilación
    /(^|\/)fixtures\.tsx?$/, // datos de prueba de un módulo (p.ej. detector de anomalías)
    /^src\/lib\/e2e\//, // infraestructura de journeys e2e (corren fuera de prod)
    /^src\/lib\/test-mocks\//, // mocks de test (unmock-prisma)
];
const esSoporteTest = (r: string) => RE_SOPORTE_TEST.some((re) => re.test(r));

export interface GrafoModulos {
    /** `src/`-módulos candidatos a huérfano: no raíz, no test, no soporte-test. */
    candidatos: string[];
    /** módulo → cuántos archivos de PRODUCCIÓN (no-test) lo importan. */
    importadoresNoTest: Map<string, number>;
}

/** Construye el grafo de imports de todo el producto (lee el FS una vez). */
export function construirGrafo(): GrafoModulos {
    const fuentes = [...caminar(RAIZ_PRODUCTO)];
    const importadoresNoTest = new Map<string, number>();
    for (const abs of fuentes) {
        const r = relativa(abs);
        const contenido = sinComentarios(fs.readFileSync(abs, "utf8"));
        const specs = new Set<string>();
        for (const re of [RE_FROM, RE_SIDE, RE_DYN]) {
            re.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = re.exec(contenido))) specs.add(m[1]);
        }
        for (const spec of specs) {
            const tgt = resolver(abs, spec);
            if (!tgt || tgt === r) continue;
            if (!esTest(r)) importadoresNoTest.set(tgt, (importadoresNoTest.get(tgt) ?? 0) + 1);
        }
    }
    const candidatos = fuentes
        .map(relativa)
        .filter((r) => r.startsWith(DIR_SRC) && /\.tsx?$/.test(r) && !esRaiz(r) && !esTest(r) && !esSoporteTest(r));
    return { candidatos, importadoresNoTest };
}

/** PURO (testeable sin FS): huérfano = candidato sin ningún importador de producción. */
export function huerfanosDe(candidatos: string[], importadoresNoTest: Map<string, number>): string[] {
    return candidatos.filter((r) => (importadoresNoTest.get(r) ?? 0) === 0).sort();
}

/** Todos los `src/`-módulos huérfanos de hoy (línea base + nuevos). */
export function modulosHuerfanos(): string[] {
    const g = construirGrafo();
    return huerfanosDe(g.candidatos, g.importadoresNoTest);
}

// `clase` separa las dos deudas (ver descripcion del JSON): un componente huérfano es basura; un
// servicio huérfano puede ser funcionalidad sin cablear (p.ej. `cita/worker.ts` → I-389).
const allowlist: { modulos: Array<{ archivo: string; clase: string; motivo: string; quien: string }> } = allowlistJson;
const PERMITIDOS = new Set(allowlist.modulos.map((m) => m.archivo));

/** Huérfanos NUEVOS (fuera de la allowlist) → el número subió: ROJO. */
export function huerfanosNuevos(): string[] {
    return modulosHuerfanos().filter((r) => !PERMITIDOS.has(r));
}

/** Entradas de la allowlist que ya NO son huérfanas (se cablearon o se borraron) → sacalas: el ratchet baja. */
export function entradasObsoletas(): string[] {
    const actuales = new Set(modulosHuerfanos());
    return allowlist.modulos.map((m) => m.archivo).filter((a) => !actuales.has(a)).sort();
}
