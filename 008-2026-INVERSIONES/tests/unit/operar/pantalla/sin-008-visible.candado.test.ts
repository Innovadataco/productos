// Candado: el producto se llama «Inversiones» y ningún texto de la app dice «008» (el logo, los títulos, los avisos, las
// notas). Recorre el código de src/app/** (menos resumen-ia/, que cambia otro frente) y de src/operar/** y las unidades de las series, sin
// los comentarios, y falla si queda un «008» suelto. Los identificadores (rutas «008-2026-…», «inv-008-db») no cuentan:
// son nombres, no texto. Con control positivo: si el detector deja de morder, esto se pone rojo.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "src");
const EXCLUIDOS = ["app/_comun/resumen-ia"];
const ADICIONALES = ["datos-oficiales/series/consulta.ts"];
/** Otras carpetas de texto visible: el simulador y el informe de /operar. (src/ia y src/precios son de otros frentes.) */
const CARPETAS_EXTRA = ["operar"];

const archivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? archivos(ruta) : /\.(ts|tsx)$/.test(n) ? [ruta] : [];
  });

/** El código sin comentarios de bloque ni de línea (aproximado, suficiente para buscar texto visible). */
export const sinComentarios = (codigo: string): string =>
  codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\w])\/\/.*$/gm, "$1");

const SUELTO = /(?<![\w\-/:])008(?![\w\-/:])/;
export const tiene008Visible = (codigo: string): boolean => SUELTO.test(sinComentarios(codigo));

describe("el detector de «008» visible muerde", () => {
  it("lo ve en un texto, en un título y en el logo", () => {
    expect(tiene008Visible('<h1>No se pudo leer la base de 008</h1>')).toBe(true);
    expect(tiene008Visible('const PIE = "008 informa";')).toBe(true);
    expect(tiene008Visible('<span className="sello">008</span>')).toBe(true);
  });
  it("no lo ve en comentarios ni en identificadores", () => {
    expect(tiene008Visible("/** Cuándo lo trajo 008 */ const x = 1;")).toBe(false);
    expect(tiene008Visible("// frente de 008\nconst x = 1;")).toBe(false);
    expect(tiene008Visible("{/* de 008 */}")).toBe(false);
    expect(tiene008Visible('const ruta = "008-2026-INVERSIONES/scripts"; const host = "inv-008-db";')).toBe(false);
  });
});

describe("la app no dice «008» en ningún texto", () => {
  const todos = [
    ...archivos(join(SRC, "app")).filter((r) => !EXCLUIDOS.some((e) => relative(SRC, r).startsWith(e))),
    ...CARPETAS_EXTRA.flatMap((c) => archivos(join(SRC, c))),
    ...ADICIONALES.map((r) => join(SRC, r)),
  ];
  it("recorre archivos de verdad", () => expect(todos.length).toBeGreaterThan(50));
  it("incluye src/operar/** y no src/ia ni src/precios", () => {
    const rel = todos.map((r) => relative(SRC, r));
    expect(rel.some((r) => r.startsWith("operar/simulador/"))).toBe(true);
    expect(rel.some((r) => r.startsWith("ia/") || r.startsWith("precios/"))).toBe(false);
  });
  it("ninguno trae un «008» suelto fuera de los comentarios", () => {
    const con = todos.filter((r) => tiene008Visible(readFileSync(r, "utf8"))).map((r) => relative(SRC, r));
    expect(con).toEqual([]);
  });
});
