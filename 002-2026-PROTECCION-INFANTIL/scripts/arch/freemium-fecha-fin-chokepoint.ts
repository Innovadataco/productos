import * as fs from "node:fs";
import * as path from "node:path";

/**
 * SPEC-795 (PR 3) · sección de arch:check — `freemiumFechaFin` se calcula en UN SOLO lugar.
 *
 * El fin del periodo de prueba (`Suscripcion.freemiumFechaFin`) es aritmética de calendario y DEBE
 * pasar por la zona Bogotá (FR-003). `calcularFreemiumFechaFin` (freemium-calculos.ts) es el único
 * productor autorizado: `toZonedTime → startOfDay → addDays → endOfDay → fromZonedTime`.
 *
 * El defecto que cierra esto (medido en PROD: 8 filas reales, todas 5h cortas): `freemium-activacion`
 * sumaba el campo INLINE con `addDays` sobre `ahoraBogota()` (un pseudo-instante 5h corrido),
 * saltándose el helper. SPEC-794 arregló la función equivocada (`calcularFechaFinTrasPagoFreemium`,
 * que nunca corría) porque se barrieron los LLAMADORES, no los ESCRITORES DEL CAMPO. Este candado
 * hace el camino inline IMPOSIBLE, no desaconsejado: calcular `freemiumFechaFin` con aritmética de
 * fecha cruda (addDays/addMonths/setMonth) fuera del productor único pone arch:check en ROJO.
 *
 * NO es allowlist growable: la ÚNICA vía autorizada está hardcodeada; una excepción exige tocar
 * este archivo (fricción deliberada). Asignar desde `calcularFreemiumFechaFin(...)` o LEER el campo
 * (`suscripcion.freemiumFechaFin`) no matchean — solo el cálculo inline.
 */

const RAIZ = path.resolve(__dirname, "../..");
const DIRS = [path.join(RAIZ, "src"), path.join(RAIZ, "scripts")];
const PERMITIDOS = new Set(["src/lib/pagos/freemium-calculos.ts"]);
// Detecta el cálculo INLINE del campo: asignarle (con `=` o `:`) el resultado directo de
// addDays/addMonths/setMonth (aritmética de fecha cruda). El único productor devuelve el valor y los
// consumidores asignan desde `calcularFreemiumFechaFin(...)`, que NO matchea. Leer el campo tampoco.
export const PATRON_INLINE = /freemiumFechaFin\s*[=:]\s*(addDays|addMonths|setMonth)\s*\(/;

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
                if (PATRON_INLINE.test(texto)) {
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
        console.log("[freemium-fecha-fin-chokepoint] VERDE: cero cálculos inline de freemiumFechaFin fuera del productor único.");
    } else {
        console.error(`[freemium-fecha-fin-chokepoint] ROJO: ${infractores.length} cálculos inline (usá calcularFreemiumFechaFin):`);
        for (const f of infractores) console.error(`  - ${f.archivo}:${f.linea} ${f.texto}`);
        process.exitCode = 1;
    }
}
