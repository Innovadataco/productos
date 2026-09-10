/**
 * SPEC-610 (I-372) · CANDADO DE CABLEADO — el pase del psicólogo tiene que ser ALCANZABLE.
 *
 * El mecanismo del pase (`CodigoAccesoContenido`, `/api/reportes/acceso/*`, la
 * página `/canjear-acceso`) estaba COMPLETO y bien hecho, pero vivió MUERTO
 * meses: `/canjear-acceso` no estaba enlazada desde ninguna parte —solo aparecía
 * en `src/lib/proxy.ts`, que es POLÍTICA DE RUTAS, no navegación—, así que el
 * profesional tenía que adivinar la URL. `LecturaReporte` = 0 filas en prod.
 * Ningún test de la pieza lo delataba: el mecanismo pasa sus pruebas; lo que no
 * existía era el CAMINO del usuario hasta él.
 *
 * Este es el candado que el radicado pone por encima del resto del PR: recorre el
 * ÁRBOL DE RENDER del área del profesional (BFS de imports desde su page de
 * inicio) y muere si NINGÚN archivo del árbol enlaza a `/canjear-acceso`. Es la
 * otra mitad del candado del menú (SPEC-437/I-299, que exige que la ruta exista):
 * aquí se exige que se ALCANCE.
 *
 * LÍMITE que confiesa: verifica que la ruta aparece enlazada en el árbol de
 * render del profesional; NO verifica que el usuario tenga el módulo que la
 * gatea, ni que el destino renderice bien — esas capas viven en el candado del
 * menú y en el recorrido en vivo de Calidad.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "../..");
// Punto de entrada del área del profesional (su home vía homeParaRol).
const RAIZ_PROFESIONAL = path.join(SRC, "app/dashboard/profesional/page.tsx");
const RUTA_CANJE = "/canjear-acceso";

// Un enlace COMENTADO no es un enlace: se detecta sobre código SIN comentarios,
// si no, un `// ver /canjear-acceso` (o esta misma cabecera) daría falso verde.
function sinComentarios(s: string): string {
    return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Resuelve un especificador local (@/… o relativo) a un archivo real, o null. */
function resolver(spec: string, desde: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
    else if (spec.startsWith("./") || spec.startsWith("../")) base = path.resolve(path.dirname(desde), spec);
    else return null; // paquete de npm u otra cosa: fuera del árbol propio
    const candidatos = [
        base,
        `${base}.tsx`, `${base}.ts`,
        path.join(base, "index.tsx"), path.join(base, "index.ts"),
    ];
    return candidatos.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

/** BFS del árbol de render desde `entrada`, siguiendo solo imports LOCALES. */
function arbolDeRender(entrada: string): { archivos: string[]; textoConcat: string } {
    const vistos = new Set<string>();
    const cola = [entrada];
    const importRe = /(?:import[\s\S]*?from|import)\s*["']([^"']+)["']/g;
    let textoConcat = "";
    while (cola.length) {
        const actual = cola.shift()!;
        if (vistos.has(actual) || !fs.existsSync(actual)) continue;
        vistos.add(actual);
        const codigo = fs.readFileSync(actual, "utf-8");
        // Los imports se leen del código crudo; el match del enlace, sin comentarios.
        textoConcat += `\n__${actual}__\n` + sinComentarios(codigo);
        for (const m of codigo.matchAll(importRe)) {
            const destino = resolver(m[1]!, actual);
            if (destino && !vistos.has(destino)) cola.push(destino);
        }
    }
    return { archivos: [...vistos], textoConcat };
}

describe("SPEC-610 · /canjear-acceso está enlazada en el árbol de render del profesional (I-372)", () => {
    it("existe el punto de entrada del área del profesional", () => {
        expect(fs.existsSync(RAIZ_PROFESIONAL), `No encontré ${RAIZ_PROFESIONAL}`).toBe(true);
    });

    it("algún archivo del árbol de render del profesional enlaza a /canjear-acceso", () => {
        const { archivos, textoConcat } = arbolDeRender(RAIZ_PROFESIONAL);
        expect(archivos.length, "El BFS no recorrió nada — revisá el punto de entrada.").toBeGreaterThan(3);
        expect(
            textoConcat.includes(RUTA_CANJE),
            "El profesional no puede LLEGAR a /canjear-acceso desde su área: ningún archivo de su " +
                "árbol de render la enlaza. Esto es I-372 otra vez — el mecanismo del pase existe pero " +
                "nadie lo alcanza. Poné un enlace visible (Link href=\"/canjear-acceso\") en el árbol " +
                "de render del profesional. Aparecer solo en proxy.ts NO cuenta: es política de rutas.",
        ).toBe(true);
    });
});
