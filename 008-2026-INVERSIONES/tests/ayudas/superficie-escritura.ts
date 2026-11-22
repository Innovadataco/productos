// Clasificador del candado de escrituras (frente familia-lectura): lo usa tests/unit/auth/escrituras.candado.test.ts
// sobre el árbol real y, para los controles positivos, sobre fuentes inventadas. Puro: lee por funciones que recibe
// (así un control positivo usa un árbol en memoria). No es una prueba (no termina en .test.ts).
//  - Métodos de un route.ts: solo se admite `export [async] function <MÉTODO>(`; cualquier otra forma de exportar un
//    método (const, re-export, `export *`, `export default`) es irregular y da rojo, porque esquivaría la detección.
//  - Escrituras en la base: los delegados de Prisma (los modelos de prisma/schema.prisma) con create/update/upsert/
//    delete y sus «Many», `$executeRaw` (salvo `SET TRANSACTION READ ONLY`), `$executeRawUnsafe`, `$queryRawUnsafe`
//    y un `$queryRaw` con INSERT, UPDATE o DELETE.
//  - Grafo de importaciones desde una entrada: no baja por las importaciones solo de tipos ni por las que traen de un
//    módulo escritor solo constantes revisadas (lista cerrada en la prueba).
import { dirname, join, resolve } from "node:path";

export const METODOS_ESCRITURA = ["POST", "PUT", "PATCH", "DELETE"] as const;
const METODOS = ["GET", "HEAD", "OPTIONS", ...METODOS_ESCRITURA] as const;
const ALTERNATIVA = METODOS.join("|");

/** Los métodos que declara un route.ts con la forma admitida. */
export function metodosDeclarados(fuente: string): string[] {
  return [...fuente.matchAll(new RegExp(`^export\\s+(?:async\\s+)?function\\s+(${ALTERNATIVA})\\s*\\(`, "gm"))].map((m) => m[1] ?? "");
}

/** Formas de exportar desde un route.ts que el candado no admite (cada una esquivaría `metodosDeclarados`). */
export function exportacionesIrregulares(fuente: string): string[] {
  const reglas: readonly (readonly [string, RegExp])[] = [
    ["método como variable", new RegExp(`^export\\s+(?:const|let|var)\\s+(?:${ALTERNATIVA})\\b`, "m")],
    ["método re-exportado", new RegExp(`^export\\s*(?:type\\s*)?\\{[^}]*\\b(?:${ALTERNATIVA})\\b[^}]*\\}`, "m")],
    ["export *", /^export\s*\*/m],
    ["export default", /^export\s+default\b/m],
  ];
  return reglas.filter(([, r]) => r.test(fuente)).map(([nombre]) => nombre);
}

export const escribe = (metodos: readonly string[]): boolean => metodos.some((m) => (METODOS_ESCRITURA as readonly string[]).includes(m));
export const llamaGuardianApi = (fuente: string): boolean => /\bexigirDuenoApi\(/.test(fuente);
export const llamaGuardianPagina = (fuente: string): boolean => /\bexigirDueno\(\)/.test(fuente);
export const esServerAction = (fuente: string): boolean => /^\s*["']use server["']/m.test(fuente);
export const importaDinamico = (fuente: string): boolean => /\bimport\s*\(|\brequire\s*\(/.test(fuente);

/** Los delegados de Prisma (`usuario`, `tokenAcceso`…) de los modelos del esquema. */
export function delegadosDelEsquema(esquema: string): string[] {
  return [...esquema.matchAll(/^model\s+([A-Z]\w*)\s*\{/gm)].map((m) => {
    const nombre = m[1] ?? "";
    return nombre.charAt(0).toLowerCase() + nombre.slice(1);
  });
}

/** Un detector de escrituras en la base para estos delegados. */
export function detectorDeEscritura(delegados: readonly string[]): (fuente: string) => boolean {
  if (delegados.length === 0) throw new Error("Sin delegados: el esquema no se leyó.");
  const prisma = new RegExp(`\\.\\s*(?:${delegados.join("|")})\\s*\\.\\s*(?:create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany)\\s*\\(`);
  const crudo = /\.\$executeRaw\s*`(?!SET TRANSACTION READ ONLY`)|\.\$executeRaw\s*\(|\.\$executeRawUnsafe\s*\(|\.\$queryRawUnsafe\s*\(|\.\$queryRaw\s*`\s*(?:INSERT|UPDATE|DELETE)\b/i;
  return (fuente) => prisma.test(fuente) || crudo.test(fuente);
}

export interface Arista {
  readonly destino: string;
  /** Nombres importados con llaves (sin `type`), o null si es `* as`, por defecto o de efecto. */
  readonly nombres: readonly string[] | null;
  readonly soloTipos: boolean;
}

export interface Arbol {
  readonly src: string;
  readonly existe: (ruta: string) => boolean;
  readonly leer: (ruta: string) => string;
}

function resolverEspecificador(arbol: Arbol, desde: string, especificador: string): string {
  if (!especificador.startsWith(".") && !especificador.startsWith("@/")) return especificador;
  const base = especificador.startsWith("@/") ? join(arbol.src, especificador.slice(2)) : resolve(dirname(desde), especificador);
  return [".ts", ".tsx", "/index.ts", "/index.tsx"].map((ext) => `${base}${ext}`).find(arbol.existe) ?? base;
}

const IMPORTACION = /^\s*(import|export)\s+(type\s+)?([^"';]*?)\s*from\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm;

/** Las importaciones (y re-exportaciones) de un archivo, resueltas a rutas; los paquetes quedan por nombre. */
export function aristas(arbol: Arbol, ruta: string): Arista[] {
  return [...arbol.leer(ruta).matchAll(IMPORTACION)].map((m) => {
    const destino = resolverEspecificador(arbol, ruta, m[4] ?? m[5] ?? "");
    const clausula = m[3] ?? "";
    const llaves = /^\{([^}]*)\}$/.exec(clausula.trim());
    const nombres = llaves
      ? (llaves[1] ?? "").split(",").map((s) => s.trim()).filter((s) => s.length > 0)
      : null;
    const soloTipos = Boolean(m[2]) || (nombres !== null && nombres.length > 0 && nombres.every((n) => n.startsWith("type ")));
    const valores = nombres?.filter((n) => !n.startsWith("type ")).map((n) => n.split(/\s+as\s+/)[0] ?? n) ?? null;
    return { destino, nombres: valores, soloTipos };
  });
}

/**
 * Los módulos de src alcanzables desde `entrada`. No baja por importaciones solo de tipos ni por las que traen de un
 * módulo de `constantes` únicamente nombres de su lista.
 */
export function alcanzables(arbol: Arbol, entrada: string, constantes: ReadonlyMap<string, ReadonlySet<string>> = new Map()): Set<string> {
  const vistos = new Set<string>();
  const pendientes = [entrada];
  while (pendientes.length > 0) {
    const actual = pendientes.pop() ?? "";
    if (vistos.has(actual)) continue;
    vistos.add(actual);
    if (!actual.startsWith(arbol.src) || !arbol.existe(actual)) continue;
    for (const a of aristas(arbol, actual)) {
      if (a.soloTipos) continue;
      const permitidas = constantes.get(a.destino);
      if (permitidas && a.nombres !== null && a.nombres.every((n) => permitidas.has(n))) continue;
      pendientes.push(a.destino);
    }
  }
  return vistos;
}

/** Los valores de `usuarioId:` y de `where: { id: … }` de una fuente (para el candado de IDOR). */
export function identificadoresUsados(fuente: string): string[] {
  const usuario = [...fuente.matchAll(/\busuarioId\s*:\s*([\w.]+)/g)].map((m) => m[1] ?? "");
  const donde = [...fuente.matchAll(/\bwhere\s*:\s*\{\s*id\s*:\s*([\w.]+)/g)].map((m) => m[1] ?? "");
  return [...usuario, ...donde];
}
