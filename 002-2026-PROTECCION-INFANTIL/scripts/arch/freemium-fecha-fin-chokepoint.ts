import * as fs from "node:fs";
import * as path from "node:path";

/**
 * SPEC-795 (PR 3) · sección de arch:check — `freemiumFechaFin` se calcula en UN SOLO lugar.
 *
 * El fin del periodo de prueba (`Suscripcion.freemiumFechaFin`) es aritmética de calendario y DEBE
 * pasar por la zona Bogotá (FR-003). `calcularFreemiumFechaFin` (freemium-calculos.ts) es el único
 * productor autorizado: `toZonedTime → startOfDay → addDays → endOfDay → fromZonedTime`.
 *
 * El defecto que cierra (medido en PROD: 8 filas reales, 5h cortas): `freemium-activacion` sumaba el
 * campo con `addDays` sobre `ahoraBogota()`, saltándose el helper. SPEC-794 arregló la función
 * equivocada porque se barrieron los LLAMADORES, no los ESCRITORES DEL CAMPO.
 *
 * LISTA BLANCA, no lista negra (falla CERRADA): toda ASIGNACIÓN del campo (`freemiumFechaFin =`, o
 * `freemiumFechaFin:` como clave) cuyo lado derecho NO sea una forma AUTORIZADA es infractora. La
 * lista negra anterior (`addDays|addMonths|setMonth`) cazaba la forma de UNA línea —la que existía—,
 * envejecía con la próxima función de date-fns que nadie anticipara, y dejaba pasar la forma de DOS
 * líneas: `const fin = addDays(…)` seguido de `freemiumFechaFin: fin`, porque ahí la línea del campo
 * no menciona aritmética. La lista blanca la caza gratis: `fin` no es el productor ni una lectura.
 *
 * Lados derechos AUTORIZADOS (cualquier otra cosa → ROJO):
 *  1. el productor único `calcularFreemiumFechaFin(…)`;
 *  2. una RE-LECTURA del valor ya calculado: un acceso que EMPIEZA en `freemiumFechaFin`
 *     (`freemiumFechaFin.toISOString()`, `suscripcion.freemiumFechaFin`) — no un cómputo que lo
 *     envuelva: `addMonths(x.freemiumFechaFin, 1)` empieza por la función, no pasa;
 *  3. una ANOTACIÓN DE TIPO (`Date | null`, `string | null`) o un predicado/selector/orden de Prisma
 *     (`{ lt: … }`, `{ not: null }`, `true`, `"asc"`): no son VALORES computados del campo.
 *
 * ROJO POR DISEÑO — asignar el campo desde una VARIABLE, aunque el productor la haya computado:
 *   `const fin = calcularFreemiumFechaFin(…); … data: { freemiumFechaFin: fin }`  → ROJO.
 * NO es falso positivo: el SITIO de asignación debe EXHIBIR la procedencia del valor (si no, la forma
 * de dos líneas vuelve por la ventana). Dos vías verdes: llamar al productor EN el sitio
 * (`freemiumFechaFin: calcularFreemiumFechaFin(…)`), o nombrar la variable `freemiumFechaFin` y pasarla
 * por shorthand (`{ freemiumFechaFin }`, sin `:`, que ni matchea). Si ves este rojo el candado NO está
 * roto: mové la procedencia al sitio de asignación, no aflojes la forma (2).
 *
 * Por qué por FORMA del lado derecho y no «sin `:`»: el campo aparece como CLAVE con `:` en tipos,
 * cláusulas Prisma y serializaciones —todas legítimas—, así que «la lectura no lleva `:`» no alcanza.
 * NO es allowlist growable de funciones prohibidas: lo AUTORIZADO está cerrado; una forma nueva no
 * reconocida sale ROJA (falla cerrada), no pasa en silencio. Exento solo el productor y este propio
 * archivo (menciona el campo y ejemplos de las formas prohibidas; no es código de producción).
 */

const RAIZ = path.resolve(__dirname, "../..");
const DIRS = [path.join(RAIZ, "src"), path.join(RAIZ, "scripts")];
const PERMITIDOS = new Set([
    "src/lib/pagos/freemium-calculos.ts", // el ÚNICO productor autorizado del valor
    "scripts/arch/freemium-fecha-fin-chokepoint.ts", // este candado: nombra el campo y ejemplos de las formas prohibidas
]);

// Una ASIGNACIÓN del campo: `freemiumFechaFin` como destino de `=` o como clave `:`. El lookbehind
// `(?<![.\w])` descarta accesos (`x.freemiumFechaFin`) y ternarias (`? a.freemiumFechaFin : b`), que
// no son asignaciones del campo. El grupo 1 captura el lado derecho hasta el fin de línea.
export const ASIGNACION_CAMPO = /(?<![.\w])freemiumFechaFin\s*[=:]\s*(.+)$/;

/**
 * ¿El lado derecho de una asignación de `freemiumFechaFin` es una forma AUTORIZADA? Lista blanca (ver
 * docblock): productor único · re-lectura del valor · anotación de tipo / predicado Prisma. Lo demás, no.
 */
export function ladoDerechoAutorizado(ladoDerecho: string): boolean {
    const r = ladoDerecho.trim();
    if (/^(await\s+)?calcularFreemiumFechaFin\s*\(/.test(r)) return true; // (1) productor único
    if (/^[\w.]*\bfreemiumFechaFin\b/.test(r)) return true; // (2) re-lectura: acceso que EMPIEZA en el campo
    if (/^(Date|string|number|boolean|null|undefined)\b(?!\s*[.(])/.test(r)) return true; // (3a) tipo (no `Date.now()`)
    if (/^\{/.test(r) || /^(true|false)\b/.test(r) || /^"/.test(r)) return true; // (3b) predicado/selector/orden Prisma
    return false;
}

/** Una línea es infractora si ASIGNA el campo con un lado derecho NO autorizado. */
export function esLineaInfractora(linea: string): boolean {
    const m = linea.match(ASIGNACION_CAMPO);
    return m !== null && !ladoDerechoAutorizado(m[1]);
}

// TOCTOU: cuando este scan corre DENTRO del suite (lo invoca su `.test.ts`), otros tests crean y
// borran archivos temporales bajo `src/` en paralelo (p. ej. el positivo-control de
// tokens-ratchet-sin-serializar planta `src/__spec466_tmp__/`). Un archivo/dir puede desaparecer entre
// el listado y la lectura → ENOENT. Un scanner de árbol debe tolerarlo: el que se va no es infractor.
function sinENOENT<T>(fn: () => T, fallback: T): T {
    try {
        return fn();
    } catch (e) {
        if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return fallback;
        throw e;
    }
}

function* caminar(dir: string): Generator<string> {
    const entradas = sinENOENT(() => fs.readdirSync(dir, { withFileTypes: true }), []);
    for (const entrada of entradas) {
        const completa = path.join(dir, entrada.name);
        if (entrada.isDirectory()) {
            if (entrada.name === "node_modules") continue;
            yield* caminar(completa);
        } else if (/\.tsx?$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name)) {
            // Los `.test.ts(x)` quedan FUERA del scan: su propio test de control positivo contiene las
            // formas prohibidas como literales de muestra (el nombre del campo asignado con aritmética
            // cruda), y el candado protege la superficie que SE DESPLIEGA (src/ + scripts/), no fixtures.
            yield completa;
        }
    }
}

export interface InfractorFreemiumFechaFin {
    archivo: string;
    linea: number;
    texto: string;
}

export function buscarInfractores(): InfractorFreemiumFechaFin[] {
    const infractores: InfractorFreemiumFechaFin[] = [];
    for (const dir of DIRS) {
        for (const rutaAbsoluta of caminar(dir)) {
            const relativa = path.relative(RAIZ, rutaAbsoluta).split(path.sep).join("/");
            if (PERMITIDOS.has(relativa)) continue;
            const contenido = sinENOENT(() => fs.readFileSync(rutaAbsoluta, "utf-8"), null);
            if (contenido === null) continue; // desapareció entre el listado y la lectura (TOCTOU)
            const lineas = contenido.split("\n");
            lineas.forEach((texto, i) => {
                if (esLineaInfractora(texto)) {
                    infractores.push({ archivo: relativa, linea: i + 1, texto: texto.trim() });
                }
            });
        }
    }
    return infractores;
}

// CLI: `npx tsx scripts/arch/freemium-fecha-fin-chokepoint.ts` (también la usa arch-check.ts).
if (process.argv[1] && process.argv[1].endsWith("freemium-fecha-fin-chokepoint.ts")) {
    const infractores = buscarInfractores();
    if (infractores.length === 0) {
        console.log("[freemium-fecha-fin-chokepoint] VERDE: toda asignación de freemiumFechaFin viene del productor único.");
    } else {
        console.error(`[freemium-fecha-fin-chokepoint] ROJO: ${infractores.length} asignación(es) de freemiumFechaFin fuera de calcularFreemiumFechaFin:`);
        for (const f of infractores) console.error(`  - ${f.archivo}:${f.linea} ${f.texto}`);
        process.exitCode = 1;
    }
}
