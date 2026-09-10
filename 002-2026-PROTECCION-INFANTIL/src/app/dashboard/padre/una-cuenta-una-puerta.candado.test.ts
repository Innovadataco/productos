/**
 * SPEC-616 (I-375 · reparo de SPEC-609 · «una cuenta, una puerta») · CANDADO ANTIRREGRESIÓN DE CLASE
 * SOBRE EL ÁRBOL DE RENDER (no sobre una carpeta).
 *
 * Jelkin retiró el botón «Crear contraseña» (SPEC-598) del área del padre: una cuenta creada por
 * Google no necesita —ni entiende— que le ofrezcan crear una contraseña que nadie pidió. El candado
 * no vigila ese botón puntual sino la CLASE: cualquier control del área del padre que ofrezca
 * CREAR/ESTABLECER una contraseña (distinto de «cambiar» la que ya se tiene) o que enrute al flujo de
 * creación. Si alguien lo re-introduce «arreglándolo de vuelta», muere.
 *
 * POR QUÉ SE REESCRIBIÓ (I-375): la versión de SPEC-609 se declaraba «de clase» pero barría dos
 * CARPETAS (`dashboard/padre/**` y `components/modules/padre/**`). El botón vivía en
 * `components/modules/NavHeader.tsx` —el encabezado compartido, que el layout RAÍZ monta encima de
 * todas las páginas— así que quedaba FUERA de las dos carpetas y el candado dio verde con el defecto
 * VIVO en producción. Un candado que se cree más ancho de lo que es es peor que no tenerlo. El área del
 * padre no es una carpeta: es un ÁRBOL DE RENDER, y el encabezado cuelga de ese árbol aunque el archivo
 * viva en otro lado. (Mismo método que Dev 2 usó en #532 para el pase del profesional.)
 *
 * CÓMO: BFS del árbol de render del área del padre, sembrado con
 *   · el chrome compartido que la envuelve: layout RAÍZ (monta NavHeader) + layout del área autenticada,
 *   · TODOS los `page.tsx`/`layout.tsx` de la zona canónica del padre (`dashboard/padre/**`, SPEC-317),
 * siguiendo solo imports LOCALES (`@/…` y relativos). Así se ALCANZA NavHeader aunque viva en
 * `components/modules/`. Se escanea sobre el código SIN comentarios (un puntero como este menciona
 * «Crear contraseña» a propósito; lo que importa es el control renderizado, no la prosa).
 *
 * MUTACIÓN OBLIGATORIA (cómo se prueba que muere): volvé a poner «Crear contraseña» en `NavHeader.tsx`
 * → este candado se pone ROJO. Si no muere ahí, la raíz del árbol no está alcanzando el chrome
 * compartido (la trampa original) — el primer `it` de abajo vigila exactamente eso.
 *
 * LÍMITE que confiesa: cubre la zona canónica del padre (`dashboard/padre/**`) + el chrome compartido
 * que la envuelve. Una ruta que el padre alcanza pero que vive fuera de esa zona (p. ej. `/mis-reportes`)
 * no está sembrada acá; su propio candado de área la cubriría.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "../../.."); // src/app/dashboard/padre → src
const APP = path.join(SRC, "app");
const ZONA_PADRE = path.join(APP, "dashboard/padre");

// La clase prohibida: ofrecer la CREACIÓN de una contraseña, o enrutar a ese flujo.
const PATRONES: { re: RegExp; nombre: string }[] = [
    { re: /Crear\s+contrase/i, nombre: "Crear contraseña" },
    { re: /Establecer\s+contrase/i, nombre: "Establecer contraseña" },
    { re: /Crear\s+clave/i, nombre: "Crear clave" },
    { re: /crear-password/i, nombre: "ruta/endpoint crear-password" },
];

/** Quita comentarios de bloque y de línea para no cazar la prosa de los punteros (`[^:]` deja los `://`). */
function sinComentarios(s: string): string {
    return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Resuelve un especificador local (`@/…` o relativo) a un archivo real, o null (npm/otro → fuera del árbol). */
function resolver(spec: string, desde: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
    else if (spec.startsWith("./") || spec.startsWith("../")) base = path.resolve(path.dirname(desde), spec);
    else return null;
    const candidatos = [base, `${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx"), path.join(base, "index.ts")];
    return candidatos.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

/** page.tsx / layout.tsx recursivos bajo `dir` (los puntos de entrada del render de cada ruta). */
function rutasBajo(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const salida: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) salida.push(...rutasBajo(p));
        else if (/^(page|layout)\.(tsx?|jsx?)$/.test(e.name) && !/\.(test|candado)\./.test(e.name)) salida.push(p);
    }
    return salida;
}

/** Semillas = árbol de render del área del padre: chrome compartido + todas las rutas de la zona canónica. */
function semillas(): string[] {
    const fijas = [
        path.join(APP, "layout.tsx"), // layout RAÍZ: monta NavHeader (el chrome que envuelve TODO)
        path.join(APP, "dashboard/layout.tsx"), // layout del área autenticada
    ];
    return [...fijas, ...rutasBajo(ZONA_PADRE)].filter((f) => fs.existsSync(f));
}

/** BFS del árbol de render desde varias semillas, siguiendo solo imports LOCALES. archivo → código SIN comentarios. */
function arbolDeRender(seeds: string[]): Map<string, string> {
    const porArchivo = new Map<string, string>();
    const cola = [...seeds];
    const importRe = /(?:import[\s\S]*?from|import)\s*["']([^"']+)["']/g;
    while (cola.length) {
        const actual = cola.shift()!;
        if (porArchivo.has(actual) || !fs.existsSync(actual) || !fs.statSync(actual).isFile()) continue;
        const codigo = fs.readFileSync(actual, "utf-8");
        // Los imports se leen del código crudo; el match del patrón, sin comentarios.
        porArchivo.set(actual, sinComentarios(codigo));
        for (const m of codigo.matchAll(importRe)) {
            const destino = resolver(m[1]!, actual);
            if (destino && !porArchivo.has(destino)) cola.push(destino);
        }
    }
    return porArchivo;
}

describe("SPEC-616 · el área del padre NO ofrece crear contraseña (antirregresión de clase, árbol de render)", () => {
    const arbol = arbolDeRender(semillas());

    it("el BFS recorre el árbol del padre y ALCANZA el chrome compartido (NavHeader)", () => {
        expect(arbol.size, "El BFS no recorrió nada — revisá las semillas del árbol.").toBeGreaterThan(5);
        const alcanzaNavHeader = [...arbol.keys()].some((f) => f.endsWith(`${path.sep}components${path.sep}modules${path.sep}NavHeader.tsx`));
        expect(
            alcanzaNavHeader,
            "El árbol de render del padre NO alcanzó NavHeader (el encabezado compartido). Sin él, este " +
                "candado vuelve a ser ciego al lugar exacto donde vivía el botón (I-375). La semilla debe " +
                "incluir el layout RAÍZ (app/layout.tsx), que es quien monta el chrome.",
        ).toBe(true);
    });

    it("ningún archivo del árbol de render del padre ofrece crear/establecer contraseña", () => {
        const hallazgos: string[] = [];
        for (const [archivo, codigo] of arbol) {
            for (const { re, nombre } of PATRONES) {
                if (re.test(codigo)) hallazgos.push(`${path.relative(process.cwd(), archivo)} :: ${nombre}`);
            }
        }
        expect(
            hallazgos,
            "Control(es) de creación de contraseña en el ÁRBOL DE RENDER del padre (no en una carpeta: el " +
                "encabezado cuelga del árbol aunque el archivo viva en otro lado — esa fue la trampa de I-375). " +
                "Revierte SPEC-598 (orden de Jelkin: «no entiendo ese botón, quítenlo»); si de verdad hace " +
                `falta, se ofrece con nombre claro desde un lugar deliberado, no en el menú del padre: ${hallazgos.join("; ")}`,
        ).toEqual([]);
    });
});
