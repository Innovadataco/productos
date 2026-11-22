// Ayudas de los candados de la zona del motor de análisis (src/analisis/**): leer sus archivos y hallar en un texto las
// palabras que dan una acción o un juicio, y las fuentes de impureza, también en lo que la zona importa. No es una prueba.
// Alcance: atrapan descuidos (una palabra, un reloj, un import a un lector con base), no una evasión deliberada (un texto
// armado por partes, homoglifos de otro alfabeto, acceso por cadenas calculadas). Para eso está la revisión.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const SRC = fileURLToPath(new URL("../../../src", import.meta.url));
export const ZONA = join(SRC, "analisis");

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

/** Un archivo de src por su ruta relativa a src («plan/niveles.ts»); null si no existe. */
export const leerSrc = (ruta: string): string | null => (existsSync(join(SRC, ruta)) ? readFileSync(join(SRC, ruta), "utf8") : null);

/**
 * Compatibilidad (NFKC: «ｃｏｍｐｒｅ» → «compre»), sin caracteres de formato (los de ancho cero), camelCase separado
 * («noConviene» → «no Conviene»), sin tildes y en minúsculas.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "")
    .replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/**
 * Palabras que dan una acción («compre», «venda», «mantenga», «reduzca») o un juicio («buena», «conviene»,
 * «oportunidad», «excesiva») y sus parecidas, sobre el texto normalizado. Los bordes son letras o dígitos: «_» corta
 * (ES_MEJOR) y «ventana» no es «venta». Solo los imperativos de los verbos que también describen («acumular», «reduce»).
 */
const PROHIBIDAS = new RegExp(
  "(?<![a-z0-9])(?:" +
    [
      "compre", "compren", "comprar", "compra", "compras", "comprela", "comprelas",
      "vender", "venda", "vendan", "vende", "venden", "vendala", "venta", "ventas",
      "mantener", "mantenga", "mantengan", "invierta", "inviertan", "adquiera", "adquieran", "liquide", "liquiden",
      "reduzca", "reduzcan", "aumente", "aumenten", "rebalancee", "rebalanceen", "acumule", "acumulen", "conserve", "conserven",
      "retenga", "retengan",
      "recomend\\w*", "recomiend\\w*", "aconsej\\w*", "consejo\\w*", "suger\\w*", "sugier\\w*",
      "conviene\\w*", "convendr\\w*", "deberia\\w*", "debiera\\w*",
      "oportun\\w*", "aprovech\\w*", "buen momento", "mal momento", "es hora de", "punto de (?:entrada|salida)",
      "buen[oa]?s?", "mal[oa]?s?", "mejor(?:es)?", "peor(?:es)?", "barat[oa]s?", "atractiv[oa]s?", "(?:sobre|infra|sub)valorad[oa]s?", "excesiv[oa]s?",
      "buy", "sell", "hold", "trim", "rebalance", "recommend\\w*", "should",
    ].join("|") +
    ")(?![a-z0-9])",
  "g",
);

export function hallarProhibidas(texto: string): readonly string[] {
  return [...normalizar(texto).matchAll(PROHIBIDAS)].map((m) => m[0]);
}

/** El archivo entero, con los saltos de línea, los espacios y las marcas de comentario como un solo espacio. */
const corrido = (texto: string): string => texto.replace(/[\s/*]+/g, " ");

const contar = (palabras: readonly string[]): Map<string, number> => palabras.reduce((m, p) => m.set(p, (m.get(p) ?? 0) + 1), new Map<string, number>());

/** Cada aparición por archivo y línea («ruta:línea: palabra»), y las que solo aparecen entre líneas («ruta: frase (entre líneas)»). */
export function prohibidasEnZona(archivos: ReadonlyMap<string, string>): readonly string[] {
  return [...archivos].flatMap(([ruta, texto]) => {
    const porLinea = texto.split("\n").flatMap((linea, i) => hallarProhibidas(linea).map((p) => ({ p, donde: `${ruta}:${i + 1}: ${p}` })));
    const enLineas = contar(porLinea.map((x) => x.p));
    const entre = [...contar(hallarProhibidas(corrido(texto)))].flatMap(([p, n]) => Array.from({ length: Math.max(0, n - (enLineas.get(p) ?? 0)) }, () => `${ruta}: ${p} (entre líneas)`));
    return [...porLinea.map((x) => x.donde), ...entre];
  });
}

/** Lo que haría impuro al motor: reloj, azar, red, proceso, consola, idioma de la máquina, base o lectores con base. */
const IMPUREZAS: readonly (readonly [string, RegExp])[] = [
  ["Date.now", /\bDate\.now\s*\(/],
  ["Date.now", /\bDate\s*\[\s*["'`]now["'`]\s*\]/],
  ["Date.now", /\{[^}]*\bnow\b[^}]*\}\s*=\s*Date\b/],
  ["new Date() sin argumentos", /\bnew Date\(\s*\)/],
  ["Date() sin new", /(?<!new\s+)\bDate\s*\(/],
  ["Math.random", /\bMath\.random\b/],
  ["crypto", /\bcrypto\b/],
  ["performance.now", /\bperformance\.now\b/],
  ["process", /\bprocess\b\s*[.?[]/],
  ["fetch", /\bfetch\s*\(/],
  ["require", /\brequire\s*\(/],
  ["import dinámico", /\bimport\s*\(/],
  ["node:", /["'`]node:/],
  ["consola", /\bconsole\./],
  ["localeCompare", /\blocaleCompare\b/],
  ["Intl o toLocale", /\bIntl\b|\btoLocale\w*/],
  ["globales del entorno", /\b(?:globalThis|window|XMLHttpRequest|WebSocket|setTimeout|setInterval)\b/],
  ["server-only", /["']server-only["']/],
  ["PrismaClient", /\bPrismaClient\b/],
  ["SQL crudo", /\$queryRaw|\$executeRaw/],
  ["lector con base", /^\s*import\s+(?!type\b)[^;]*?from\s+["'][^"']*\/(?:proyecciones\/leer|plan\/lectura|plan\/resultados-lote|plan\/resultado-db|tablero\/datos|conciliacion\/leer)["']/m],
];

export function hallarImpurezas(texto: string): readonly string[] {
  return IMPUREZAS.filter(([, patron]) => patron.test(texto)).map(([nombre]) => nombre);
}

/** Los módulos que un archivo importa como valor (los `import type` y `export type` se borran al compilar). */
function importsDeValor(texto: string): readonly string[] {
  const deClausula = [...texto.matchAll(/^\s*(?:import|export)\s+(type\s+)?[^;]*?\sfrom\s+["']([^"']+)["']/gm)].filter((m) => !m[1]).map((m) => m[2]!);
  const sueltos = [...texto.matchAll(/^\s*import\s+["']([^"']+)["']/gm)].map((m) => m[1]!);
  return [...deClausula, ...sueltos];
}

/** «./b» desde «analisis/a.ts» → «analisis/b.ts»; «@/plan/x» → «plan/x.ts». */
function resolver(desde: string, especificador: string, existe: (ruta: string) => boolean): string | null {
  const base = especificador.startsWith("@/") ? especificador.slice(2) : posix.join(posix.dirname(desde), especificador);
  return [`${base}.ts`, `${base}/index.ts`].find(existe) ?? null;
}

/**
 * Recorre lo que la zona importa como valor, dentro de src, y avisa cada impureza con su camino («analisis/a.ts →
 * plan/c.ts: Date.now»). Un paquete que no es @prisma/client (solo `Prisma.Decimal`) o un módulo que no se encuentra
 * también es un aviso. `leer` devuelve el contenido de un archivo de src por su ruta relativa, o null.
 */
export function impurezasTransitivas(zona: ReadonlyMap<string, string>, leer: (ruta: string) => string | null): readonly string[] {
  const textos = new Map([...zona].map(([r, t]) => [posix.join("analisis", r.split("\\").join("/")), t]));
  const contenido = (ruta: string): string | null => textos.get(ruta) ?? leer(ruta);
  const avisos: string[] = [];
  const vistos = new Set<string>();
  const visitar = (ruta: string, camino: readonly string[]): void => {
    if (vistos.has(ruta)) return;
    vistos.add(ruta);
    const texto = contenido(ruta)!;
    const aqui = [...camino, ruta];
    if (camino.length > 0) avisos.push(...hallarImpurezas(texto).map((n) => `${aqui.join(" → ")}: ${n}`));
    for (const esp of importsDeValor(texto)) {
      if (esp === "@prisma/client") continue;
      if (!esp.startsWith(".") && !esp.startsWith("@/")) {
        avisos.push(`${aqui.join(" → ")}: paquete ${esp}`);
        continue;
      }
      const destino = resolver(ruta, esp, (r) => contenido(r) !== null);
      if (destino === null) avisos.push(`${aqui.join(" → ")}: módulo ${esp} que no se encuentra`);
      else visitar(destino, aqui);
    }
  };
  [...textos.keys()].sort().forEach((r) => visitar(r, []));
  return avisos;
}
