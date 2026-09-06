import * as fs from "node:fs";
import * as path from "node:path";

/**
 * S-D (D-116) · sección (g) de arch:check — `reporte.create`/`createMany` directo está
 * PROHIBIDO fuera del factory.
 *
 * Con `Reporte.texto`/`textoOriginal` dropeados (D-117) y `contenidoId` NOT NULL, un reporte
 * sin su contenido cifrado NO puede existir. TODO escritor pasa por `crearReporteConTexto`
 * (sella el texto en `ContenidoReporte`+`LlaveReporte` y crea el reporte, en una tx). Un
 * `.reporte.create` suelto reintroduciría la Trampa A (reporte sin texto) y saltaría el cifrado.
 *
 * NO es allowlist growable: la ÚNICA vía autorizada está hardcodeada; agregar una excepción
 * exige tocar este archivo (fricción deliberada).
 */

const RAIZ = path.resolve(__dirname, "../..");
const DIRS = [path.join(RAIZ, "src"), path.join(RAIZ, "scripts")];
const PERMITIDOS = new Set(["src/lib/dal/services/crear-reporte-con-texto.ts"]);
export const PATRON_CREATE = /\.reporte\.create(Many)?\s*\(/;

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

export interface InfractorReporteCreate {
    archivo: string;
    linea: number;
    texto: string;
}

export function buscarInfractores(): InfractorReporteCreate[] {
    const infractores: InfractorReporteCreate[] = [];
    for (const dir of DIRS) {
        for (const rutaAbsoluta of caminar(dir)) {
            const relativa = path.relative(RAIZ, rutaAbsoluta).split(path.sep).join("/");
            if (PERMITIDOS.has(relativa)) continue;
            const lineas = fs.readFileSync(rutaAbsoluta, "utf-8").split("\n");
            lineas.forEach((texto, i) => {
                if (PATRON_CREATE.test(texto)) {
                    infractores.push({ archivo: relativa, linea: i + 1, texto: texto.trim() });
                }
            });
        }
    }
    return infractores;
}

// CLI: `npx tsx scripts/arch/no-reporte-create-directo.ts` (también la usa arch-check.ts).
if (process.argv[1] && process.argv[1].endsWith("no-reporte-create-directo.ts")) {
    const infractores = buscarInfractores();
    if (infractores.length === 0) {
        console.log("[no-reporte-create-directo] VERDE: cero `reporte.create` directo fuera del factory.");
    } else {
        console.error(`[no-reporte-create-directo] ROJO: ${infractores.length} infracciones (usá crearReporteConTexto):`);
        for (const f of infractores) console.error(`  - ${f.archivo}:${f.linea} ${f.texto}`);
        process.exitCode = 1;
    }
}
