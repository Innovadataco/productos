// SPEC-413 · Generador de specs/README.md · endurecido por SPEC-432.
//
// SPEC-432 (04-09-2026): el generador bajó los conflictos pero NO los eliminó.
// En un solo día, cinco PRs chocaron acá. Medido en git, no supuesto:
//
//  - **El bloque de contadores no se puede mergear NUNCA.** Dos ramas que
//    agregan una spec cada una escriben el MISMO número (353 → 354 las dos).
//    Git ve dos cambios idénticos y los funde sin conflicto… dejando 354 donde
//    debía decir 355. No es un choque ruidoso: es un número callado y falso.
//    Por eso el resumen **dejó de vivir en el archivo commiteado** y se imprime
//    con `--resumen`. Lo que no se commitea no se puede desincronizar.
//  - **La tabla sí se puede mergear**, con `merge=union` en `.gitattributes`:
//    dos filas nuevas entran las dos, sin tocar nada a mano. Lo que union no
//    garantiza es el ORDEN, así que `--check` compara el CONJUNTO de filas y no
//    los bytes: el invariante que importa es «el índice lista exactamente las
//    specs que existen», no en qué orden quedaron. La siguiente regeneración
//    normaliza sola.
//
// Motivo: specs/README.md era el archivo con más conflictos de rebase del repo.
// Cada spec nueva añadía una fila a la MISMA tabla, y tres PRs abiertos a la vez
// chocaban ahí sin excepción (03-09-2026: 324, 327/329, 308).
//
// Diseño (mismo patrón que scripts/arch/generar-roles-capacidades.ts):
// - Fuente única: cada spec.md de specs/NNN-slug/.
// - Sale un bloque entre marcadores HTML SPEC-413:BEGIN X ... SPEC-413:END X.
// - Texto narrativo del README queda intacto (prólogo, "Incidencias de calidad
//   de datos", "Convención de archivos por spec") — solo se reescribe lo que
//   hay entre marcadores.
// - Modo con la flag "check": exit 1 si el archivo commiteado difiere del
//   generado. Se llama desde verificaciones de CI (SPEC-107, SPEC-126).
//
// Uso:
//   npx tsx scripts/specs/generar-readme.ts          reescribe el README
//   npx tsx scripts/specs/generar-readme.ts --check  verifica sin escribir
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const RAIZ_PRODUCTO = resolve(__dirname, "..", "..");
const DIR_SPECS = resolve(RAIZ_PRODUCTO, "specs");
const RUTA_README = resolve(DIR_SPECS, "README.md");

const MARCA_INICIO_TABLA = "<!-- SPEC-413:BEGIN tabla -->";
const MARCA_FIN_TABLA = "<!-- SPEC-413:END tabla -->";
const MARCA_INICIO_RESUMEN = "<!-- SPEC-413:BEGIN resumen -->";
const MARCA_FIN_RESUMEN = "<!-- SPEC-413:END resumen -->";

// Catálogo canónico (mismo que `src/lib/specs-discipline.test.ts`).
const STATUS_CANONICOS: Record<string, { emoji: string; etiqueta: string }> = {
    PLANEADO: { emoji: "🔵", etiqueta: "PLANEADO" },
    DESARROLLO: { emoji: "🟡", etiqueta: "DESARROLLO" },
    IMPLEMENTADO: { emoji: "🟢", etiqueta: "IMPLEMENTADO" },
    "PENDIENTE DE PRUEBA": { emoji: "🧪", etiqueta: "PENDIENTE DE PRUEBA" },
    FINALIZADO: { emoji: "✅", etiqueta: "FINALIZADO" },
    CERRADA: { emoji: "📁", etiqueta: "CERRADA" },
};

// Sinónimos comunes que aparecen hoy en spec.md — se mapean al canónico para
// no perder información al primer generado. El objetivo a largo plazo es que
// TODO spec.md declare el canónico (specs-discipline lo empuja).
const SINONIMOS: Record<string, string> = {
    Planeado: "PLANEADO",
    Planeada: "PLANEADO",
    "En desarrollo": "DESARROLLO",
    Desarrollo: "DESARROLLO",
    Implementado: "IMPLEMENTADO",
    Implementada: "IMPLEMENTADO",
    Finalizado: "FINALIZADO",
    Finalizada: "FINALIZADO",
    Cerrado: "CERRADA",
    Cerrada: "CERRADA",
};

interface Spec {
    carpeta: string;
    numero: number | null; // null si el prefijo no es numérico (ej: `02-reportes-comunitarios`).
    titulo: string;
    statusCrudo: string | null;
    statusCanonico: string | null; // null si no coincide con catálogo ni sinónimos.
}

function listarCarpetasSpec(): string[] {
    return readdirSync(DIR_SPECS)
        .filter((c) => {
            const ruta = resolve(DIR_SPECS, c);
            return statSync(ruta).isDirectory() && existsSync(resolve(ruta, "spec.md"));
        })
        .sort();
}

function parsearNumero(carpeta: string): number | null {
    const prefijo = carpeta.split("-")[0];
    if (!/^\d+/.test(prefijo)) return null;
    const n = parseInt(prefijo, 10);
    return Number.isFinite(n) ? n : null;
}

function parsearTitulo(contenido: string, fallback: string): string {
    const m = contenido.match(/^#\s+(.+?)\s*$/m);
    if (m) return m[1].trim();
    return fallback;
}

function parsearStatusCrudo(contenido: string): string | null {
    // Mismo regex tolerante que `specs-discipline.test.ts`.
    const m = contenido.match(/(?:Status|Estado)\**[:：]\s*\*?\*?`?([A-ZÁÉÍÓÚa-z][A-ZÁÉÍÓÚa-z ]*?)(?:`|\*|$|\(|\||\.)/m);
    return m ? m[1].trim() : null;
}

function statusCanonico(crudo: string | null): string | null {
    if (!crudo) return null;
    if (STATUS_CANONICOS[crudo]) return crudo;
    if (SINONIMOS[crudo]) return SINONIMOS[crudo];
    // Match case-insensitive contra canónico.
    const up = crudo.toUpperCase();
    if (STATUS_CANONICOS[up]) return up;
    return null;
}

function cargarSpec(carpeta: string): Spec {
    const contenido = readFileSync(resolve(DIR_SPECS, carpeta, "spec.md"), "utf-8");
    const numero = parsearNumero(carpeta);
    const titulo = parsearTitulo(contenido, carpeta);
    const statusCrudo = parsearStatusCrudo(contenido);
    return {
        carpeta,
        numero,
        titulo,
        statusCrudo,
        statusCanonico: statusCanonico(statusCrudo),
    };
}

function ordenar(specs: Spec[]): Spec[] {
    return [...specs].sort((a, b) => {
        // Numéricas primero, ordenadas asc; no numéricas al final, alfabéticas.
        if (a.numero !== null && b.numero !== null) {
            if (a.numero !== b.numero) return a.numero - b.numero;
            return a.carpeta.localeCompare(b.carpeta);
        }
        if (a.numero !== null) return -1;
        if (b.numero !== null) return 1;
        return a.carpeta.localeCompare(b.carpeta);
    });
}

function renderTabla(specs: Spec[]): string {
    const lineas: string[] = [
        MARCA_INICIO_TABLA,
        "<!-- Generado por `npx tsx scripts/specs/generar-readme.ts`. NO editar a mano — el CI de `verificaciones` compara con el generado y falla si difiere. -->",
        "",
        "| Nº | Nombre | Estado |",
        "|----|--------|--------|",
    ];
    for (const s of specs) {
        const numLabel = s.numero !== null ? String(s.numero).padStart(3, "0") : s.carpeta.split("-")[0];
        const link = `[${numLabel}](${s.carpeta}/spec.md)`;
        const tituloEscapado = s.titulo.replace(/\|/g, "\\|");
        let estado: string;
        if (s.statusCanonico) {
            const { emoji, etiqueta } = STATUS_CANONICOS[s.statusCanonico];
            estado = `${emoji} ${etiqueta}`;
        } else if (s.statusCrudo) {
            estado = `⚠️ ${s.statusCrudo} (fuera de catálogo)`;
        } else {
            estado = "⚠️ sin Status";
        }
        lineas.push(`| ${link} | ${tituloEscapado} | ${estado} |`);
    }
    lineas.push(MARCA_FIN_TABLA);
    return lineas.join("\n");
}

function renderResumen(specs: Spec[]): string {
    const conteo: Record<string, number> = {};
    let sinStatus = 0;
    let noCanonico = 0;
    for (const s of specs) {
        if (!s.statusCrudo) {
            sinStatus++;
            continue;
        }
        if (!s.statusCanonico) {
            noCanonico++;
            continue;
        }
        conteo[s.statusCanonico] = (conteo[s.statusCanonico] ?? 0) + 1;
    }
    const filas: string[] = [
        MARCA_INICIO_RESUMEN,
        "<!-- Generado por `npx tsx scripts/specs/generar-readme.ts`. NO editar a mano. -->",
        "",
        "| Métrica | Valor |",
        "|---------|-------|",
        `| **Total de specs** | **${specs.length}** |`,
    ];
    for (const key of Object.keys(STATUS_CANONICOS)) {
        const info = STATUS_CANONICOS[key];
        const n = conteo[key] ?? 0;
        filas.push(`| ${info.emoji} ${info.etiqueta} | ${n} |`);
    }
    if (noCanonico > 0) filas.push(`| ⚠️ Status fuera de catálogo | ${noCanonico} |`);
    if (sinStatus > 0) filas.push(`| ⚠️ Sin Status declarado | ${sinStatus} |`);
    filas.push(MARCA_FIN_RESUMEN);
    return filas.join("\n");
}

function reemplazarBloque(actual: string, inicio: string, fin: string, contenidoNuevo: string): string {
    const iniIdx = actual.indexOf(inicio);
    const finIdx = actual.indexOf(fin);
    if (iniIdx === -1 || finIdx === -1 || finIdx < iniIdx) {
        throw new Error(`Marcadores no encontrados o mal formados: ${inicio} … ${fin}`);
    }
    const antes = actual.slice(0, iniIdx);
    const despues = actual.slice(finIdx + fin.length);
    return antes + contenidoNuevo + despues;
}

export function generarReadme(): string {
    const carpetas = listarCarpetasSpec();
    const specs = ordenar(carpetas.map(cargarSpec));
    const tabla = renderTabla(specs);
    let readme = readFileSync(RUTA_README, "utf-8");
    // SPEC-432: el bloque de resumen ya no se escribe en el archivo. Ver cabecera.
    readme = reemplazarBloque(readme, MARCA_INICIO_TABLA, MARCA_FIN_TABLA, tabla);
    if (!readme.endsWith("\n")) readme += "\n";
    return readme;
}

/** El bloque entre marcadores, o `null` si no está. */
function extraerBloque(texto: string, inicio: string, fin: string): string | null {
    const i = texto.indexOf(inicio);
    const f = texto.indexOf(fin);
    if (i === -1 || f === -1 || f < i) return null;
    return texto.slice(i + inicio.length, f);
}

/** Las filas de la tabla, sin encabezado ni separador ni líneas vacías. */
function filasDeTabla(bloque: string): string[] {
    return bloque
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("|") && !/^\|\s*-+/.test(l) && !/^\| Spec \|/i.test(l));
}

/**
 * SPEC-432 · verificación tolerante al ORDEN y estricta en el CONTENIDO.
 *
 * Todo lo que está fuera de la tabla se compara byte a byte —ahí no hay merges
 * concurrentes—. Las filas se comparan como CONJUNTO, porque `merge=union` las
 * puede dejar en otro orden y eso no es un defecto: el índice sigue listando
 * exactamente las specs que existen. Lo que sí es defecto y se reporta: una
 * spec que falta, una fila que sobra, o una fila DUPLICADA (que es lo único
 * feo que union puede producir, cuando dos ramas agregan la misma).
 */
export function verificarReadme(): string[] {
    const problemas: string[] = [];
    const actual = readFileSync(RUTA_README, "utf-8");
    const nuevo = generarReadme();

    const bloqueActual = extraerBloque(actual, MARCA_INICIO_TABLA, MARCA_FIN_TABLA);
    const bloqueNuevo = extraerBloque(nuevo, MARCA_INICIO_TABLA, MARCA_FIN_TABLA);
    if (bloqueActual === null || bloqueNuevo === null) {
        return ["specs/README.md no tiene los marcadores de la tabla (SPEC-413:BEGIN/END tabla)."];
    }

    const fueraActual = actual.replace(bloqueActual, "");
    const fueraNuevo = nuevo.replace(bloqueNuevo, "");
    if (fueraActual !== fueraNuevo) {
        problemas.push("El texto fuera de la tabla difiere del generado.");
    }

    const filasActual = filasDeTabla(bloqueActual);
    const filasNuevo = filasDeTabla(bloqueNuevo);

    const vistas = new Set<string>();
    for (const fila of filasActual) {
        if (vistas.has(fila)) problemas.push(`Fila DUPLICADA en la tabla: ${fila}`);
        vistas.add(fila);
    }
    for (const fila of filasNuevo) {
        if (!vistas.has(fila)) problemas.push(`Falta en la tabla: ${fila}`);
    }
    const esperadas = new Set(filasNuevo);
    for (const fila of vistas) {
        if (!esperadas.has(fila)) problemas.push(`Sobra en la tabla: ${fila}`);
    }
    return problemas;
}

function main(): void {
    const argv = process.argv.slice(2);

    // SPEC-432: los contadores ya no viven en el archivo; se piden cuando se
    // quieren. Un número que se commitea es un número que dos ramas pisan.
    if (argv.includes("--resumen")) {
        const specs = ordenar(listarCarpetasSpec().map(cargarSpec));
        console.log(renderResumen(specs).split("\n").filter((l) => !l.startsWith("<!--")).join("\n").trim());
        return;
    }

    if (argv.includes("--check")) {
        const problemas = verificarReadme();
        if (problemas.length > 0) {
            console.error("[SPEC-413] specs/README.md no refleja las specs que existen:");
            for (const p of problemas) console.error(`  - ${p}`);
            console.error("[SPEC-413] Regenerar con: `npx tsx scripts/specs/generar-readme.ts` y commitear.");
            process.exit(1);
        }
        console.log("[SPEC-413] specs/README.md al día (orden de filas tolerado — SPEC-432).");
        return;
    }

    writeFileSync(RUTA_README, generarReadme());
    console.log("[SPEC-413] specs/README.md reescrito.");
}

if (require.main === module) main();
