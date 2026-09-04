// SPEC-413 · Generador de specs/README.md.
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
    const resumen = renderResumen(specs);
    let readme = readFileSync(RUTA_README, "utf-8");
    readme = reemplazarBloque(readme, MARCA_INICIO_RESUMEN, MARCA_FIN_RESUMEN, resumen);
    readme = reemplazarBloque(readme, MARCA_INICIO_TABLA, MARCA_FIN_TABLA, tabla);
    if (!readme.endsWith("\n")) readme += "\n";
    return readme;
}

function main(): void {
    const argv = process.argv.slice(2);
    const check = argv.includes("--check");
    const nuevo = generarReadme();
    if (check) {
        const actual = readFileSync(RUTA_README, "utf-8");
        if (actual !== nuevo) {
            console.error("[SPEC-413] specs/README.md está desactualizado.");
            console.error("[SPEC-413] Regenerar con: `npx tsx scripts/specs/generar-readme.ts` y commitear.");
            process.exit(1);
        }
        console.log("[SPEC-413] specs/README.md al día.");
        return;
    }
    writeFileSync(RUTA_README, nuevo);
    console.log("[SPEC-413] specs/README.md reescrito.");
}

if (require.main === module) main();
