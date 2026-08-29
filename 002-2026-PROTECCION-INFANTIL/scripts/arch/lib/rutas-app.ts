/**
 * SPEC-126: inventario del árbol `src/app/**` (page.tsx → páginas, route.ts → APIs).
 * Los segmentos dinámicos `[x]` se evalúan con un valor muestra fijo (determinista).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { relativa } from "./paths";

export interface RutaApp {
    /** Ruta tal como aparece en el árbol (con `[segmento]`). */
    ruta: string;
    /** Ruta concreta para evaluar contra el proxy (segmentos dinámicos sustituidos). */
    rutaEval: string;
    tipo: "pagina" | "api";
    archivo: string;
}

/** Valor muestra para segmentos dinámicos: solo importa el prefijo de la ruta. */
export const VALOR_MUESTRA_SEGMENTO = "muestra";

function aRuta(dirRelativo: string): { ruta: string; rutaEval: string } {
    const segmentos = dirRelativo.split(path.sep).filter(Boolean);
    if (segmentos.length === 0) return { ruta: "/", rutaEval: "/" };
    return {
        ruta: "/" + segmentos.join("/"),
        rutaEval: "/" + segmentos.map((s) => (s.startsWith("[") ? VALOR_MUESTRA_SEGMENTO : s)).join("/"),
    };
}

export function inventarioRutasApp(dirApp: string): RutaApp[] {
    const rutas: RutaApp[] = [];
    function walk(dir: string) {
        const entradas = fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((e) => !e.name.startsWith("_") && !e.name.startsWith("."))
            .sort((a, b) => a.name.localeCompare(b.name));
        for (const entrada of entradas) {
            const completa = path.join(dir, entrada.name);
            if (entrada.isDirectory()) {
                walk(completa);
                continue;
            }
            if (entrada.name !== "page.tsx" && entrada.name !== "route.ts") continue;
            const { ruta, rutaEval } = aRuta(path.relative(dirApp, dir));
            rutas.push({
                ruta,
                rutaEval,
                tipo: entrada.name === "page.tsx" ? "pagina" : "api",
                archivo: relativa(completa),
            });
        }
    }
    walk(dirApp);
    return rutas.sort((a, b) => a.ruta.localeCompare(b.ruta) || a.tipo.localeCompare(b.tipo));
}
