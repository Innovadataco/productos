import * as fs from "node:fs";
import * as path from "node:path";

/**
 * SPEC-870 (I-446) · sección (k) de arch:check — `reporte.delete`/`deleteMany` directo está
 * PROHIBIDO fuera del chokepoint de limpieza `borrar-reporte.ts`.
 *
 * `IdentificadorReportado` es un AGREGADO público (score, `esVisiblePublicamente`) SIN FK-cascade
 * desde `Reporte` (su clave es identificador+plataforma, no reporteId). Un `reporte.delete` suelto
 * borra la evidencia pero deja el agregado COLGADO → score público «de riesgo» sin un solo reporte
 * detrás (el defecto de I-446). `borrarReporte` (único autorizado) limpia el agregado huérfano en la
 * misma tx; todo borrado pasa por ahí. Para SOFT-delete/baja el camino es `darDeBajaReporte`, que ya
 * recalcula el agregado — este guard cubre el HARD-delete.
 *
 * NO es allowlist growable: la ÚNICA vía está hardcodeada; agregar una excepción exige tocar este
 * archivo (fricción deliberada, como el gemelo `no-reporte-create-directo`).
 */

const RAIZ = path.resolve(__dirname, "../..");
const DIRS = [path.join(RAIZ, "src"), path.join(RAIZ, "scripts")];
const PERMITIDOS = new Set(["scripts/limpieza/borrar-reporte.ts"]);
export const PATRON_DELETE = /\.reporte\.delete(Many)?\s*\(/;

function* caminar(dir: string): Generator<string> {
    if (!fs.existsSync(dir)) return;
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const completa = path.join(dir, entrada.name);
        if (entrada.isDirectory()) {
            if (entrada.name === "node_modules") continue;
            yield* caminar(completa);
        } else if (/\.tsx?$/.test(entrada.name)) {
            yield completa;
        }
    }
}

export interface InfractorReporteDelete {
    archivo: string;
    linea: number;
    texto: string;
}

export function buscarInfractores(): InfractorReporteDelete[] {
    const infractores: InfractorReporteDelete[] = [];
    for (const dir of DIRS) {
        for (const rutaAbsoluta of caminar(dir)) {
            const relativa = path.relative(RAIZ, rutaAbsoluta).split(path.sep).join("/");
            if (PERMITIDOS.has(relativa)) continue;
            // Los tests limpian su propio dato EFÍMERO (BD de test por-worktree); no son una fuente de
            // drift de RUNTIME/prod — el guard vigila el código de producción, no la limpieza de un test.
            if (/\.test\.tsx?$/.test(relativa)) continue;
            const lineas = fs.readFileSync(rutaAbsoluta, "utf-8").split("\n");
            lineas.forEach((texto, i) => {
                if (PATRON_DELETE.test(texto)) {
                    infractores.push({ archivo: relativa, linea: i + 1, texto: texto.trim() });
                }
            });
        }
    }
    return infractores;
}

// CLI: `npx tsx scripts/arch/no-reporte-delete-directo.ts` (también la usa arch-check.ts).
if (process.argv[1] && process.argv[1].endsWith("no-reporte-delete-directo.ts")) {
    const infractores = buscarInfractores();
    if (infractores.length === 0) {
        console.log("[no-reporte-delete-directo] VERDE: cero `reporte.delete` directo fuera de borrarReporte.");
    } else {
        console.error(`[no-reporte-delete-directo] ROJO: ${infractores.length} infracciones (usá borrarReporte, que limpia el agregado):`);
        for (const f of infractores) console.error(`  - ${f.archivo}:${f.linea} ${f.texto}`);
        process.exitCode = 1;
    }
}
