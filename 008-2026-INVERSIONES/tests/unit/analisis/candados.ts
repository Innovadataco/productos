// Ayudas de los candados de la zona del motor de análisis (src/analisis/**): leer sus archivos y hallar en un texto las
// palabras que dan una acción o un juicio, y las fuentes de impureza. No es una prueba.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const ZONA = fileURLToPath(new URL("../../../src/analisis", import.meta.url));

/** Los archivos .ts de la zona, recursivo: ruta relativa → contenido. */
export function leerZona(dir: string = ZONA): ReadonlyMap<string, string> {
  const archivos = new Map<string, string>();
  const recorrer = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const ruta = join(d, e.name);
      if (e.isDirectory()) recorrer(ruta);
      else if (e.name.endsWith(".ts")) archivos.set(relative(dir, ruta), readFileSync(ruta, "utf8"));
    }
  };
  recorrer(dir);
  return archivos;
}

/** Separa camelCase («noConviene» → «no Conviene»), quita las tildes y pasa a minúsculas. */
export function normalizar(texto: string): string {
  return texto.replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Palabras que dan una acción («compre», «venda», «mantenga») o un juicio («buena», «conviene», «oportunidad») y sus
 * parecidas, sobre el texto normalizado. Los bordes son letras o dígitos: «_» corta (ES_MEJOR) y «ventana» no es «venta».
 */
const PROHIBIDAS = new RegExp(
  "(?<![a-z0-9])(?:" +
    [
      "compre", "compren", "comprar", "compra", "compras", "comprela", "comprelas",
      "vender", "venda", "vendan", "vende", "venden", "vendala", "venta", "ventas",
      "mantener", "mantenga", "mantengan",
      "recomend\\w*", "recomiend\\w*", "aconsej\\w*", "consejo\\w*", "suger\\w*", "sugier\\w*",
      "conviene\\w*", "convendr\\w*", "deberia\\w*", "debiera\\w*",
      "oportunidad\\w*", "aprovech\\w*", "buen momento", "mal momento",
      "buen[oa]?s?", "mal[oa]?s?", "mejor(?:es)?", "peor(?:es)?", "barat[oa]s?", "atractiv[oa]s?", "(?:sobre|infra|sub)valorad[oa]s?",
      "buy", "sell", "recommend\\w*", "should",
    ].join("|") +
    ")(?![a-z0-9])",
  "g",
);

export function hallarProhibidas(texto: string): readonly string[] {
  return [...normalizar(texto).matchAll(PROHIBIDAS)].map((m) => m[0]);
}

/** Cada aparición por archivo y línea («ruta:línea: palabra»). */
export function prohibidasEnZona(archivos: ReadonlyMap<string, string>): readonly string[] {
  return [...archivos].flatMap(([ruta, texto]) => texto.split("\n").flatMap((linea, i) => hallarProhibidas(linea).map((p) => `${ruta}:${i + 1}: ${p}`)));
}

/** Lo que haría impuro al motor: reloj, azar, red, proceso, consola, comparación por idioma, base o lectores con base. */
const IMPUREZAS: readonly (readonly [string, RegExp])[] = [
  ["Date.now", /\bDate\.now\s*\(/],
  ["new Date() sin argumentos", /\bnew Date\(\s*\)/],
  ["Math.random", /\bMath\.random\b/],
  ["performance.now", /\bperformance\.now\b/],
  ["process", /\bprocess\./],
  ["fetch", /\bfetch\s*\(/],
  ["consola", /\bconsole\./],
  ["localeCompare", /\blocaleCompare\b/],
  ["server-only", /["']server-only["']/],
  ["PrismaClient", /\bPrismaClient\b/],
  ["SQL crudo", /\$queryRaw|\$executeRaw/],
  ["lector con base", /^\s*import\s+(?!type\b)[^;]*?from\s+["'][^"']*\/(?:proyecciones\/leer|plan\/lectura|plan\/resultados-lote|plan\/resultado-db|tablero\/datos|conciliacion\/leer)["']/m],
];

export function hallarImpurezas(texto: string): readonly string[] {
  return IMPUREZAS.filter(([, patron]) => patron.test(texto)).map(([nombre]) => nombre);
}
