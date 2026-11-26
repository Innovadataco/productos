/**
 * Los argumentos de `npm run ia:evaluar -- <subcomando> …` (E7). Tres subcomandos, cada uno con su lista blanca de
 * opciones (cada una una sola vez, siempre con valor):
 * - `casos [--semilla N | --paquetes <archivo.json>] [--casos <ids>]`: arma los casos y dice cuántos son; sin red ni variables;
 * - `correr --modelo <nombre> --salida <carpeta> [--paquetes <archivo.json> | --semilla N] [--pasadas 1|2]
 *   [--max-casos N | --casos <ids>] [--pausa-s N]`: corre el modelo sobre los casos (el destino llega por la variable de entorno);
 *   `--casos` son ids separados por coma (p. ej. DIARIO-16,DIARIO-17) y no se combina con `--max-casos`;
 * - `informe --salida <carpeta> --fuentes <a,b[,c[,d]]> [--pares N|todos] [--semilla N]`: métricas y pares.
 * Las rutas van absolutas. Cierra en fallo con un código; el mensaje nunca repite el valor recibido.
 */
import { PATRON_MODELO } from "../generador";
import { CANTIDAD_INVENTADOS, SEMILLA_INVENTADOS } from "./inventados.ficticio";
import { MAX_PAUSA_MS } from "./evaluar";
import { MAX_FUENTES, MIN_FUENTES } from "./pares";
import type { Pasada } from "./tipos";

/** La fuente de la línea base en el informe (la plantilla sin IA). */
export const FUENTE_PLANTILLA = "plantilla";

/** La variable de entorno con el destino de la puerta local (`http://<IPv4 de la tailnet>:<puerto>`). Nunca va al repo. */
export const VARIABLE_DESTINO = "INV_IA_LOCAL_DESTINO";
export const PAUSA_POR_OMISION_MS = 2000;
export const PARES_POR_OMISION = 10;
const MAX_SEMILLA = 4_294_967_295;
/** Todos los casos inventados: el tope de `--max-casos` y de los ids de `--casos`. */
const MAX_CASOS = Object.values(CANTIDAD_INVENTADOS).reduce((suma, n) => suma + n, 0);
/** Un id de caso: el tipo en mayúsculas, un guion y su número, o el nombre en mayúsculas de un caso exportado. */
const PATRON_ID_CASO = /^[A-Z][A-Z0-9_]{0,15}(?:-[0-9]{1,3})?$/u;
const MAX_PARES = 30;
const MS_POR_SEGUNDO = 1000;

export const USO_EVALUAR = [
  "Uso: npm run ia:evaluar -- <casos|correr|informe> …",
  "  casos   [--semilla N | --paquetes <archivo.json>] [--casos <id,id>]",
  `  correr  --modelo <nombre> --salida <carpeta absoluta> [--paquetes <archivo.json> | --semilla N] [--pasadas 1|2] [--max-casos N | --casos <id,id>] [--pausa-s N]   (destino en ${VARIABLE_DESTINO})`,
  "  informe --salida <carpeta absoluta> --fuentes <modelo,modelo|plantilla> [--pares N|todos] [--semilla N]",
].join("\n");

export type ArgumentosEvaluacion =
  | { readonly comando: "casos"; readonly semilla: number | null; readonly paquetes: string | null; readonly casos: readonly string[] | null }
  | {
    readonly comando: "correr"; readonly modelo: string; readonly salida: string; readonly semilla: number | null; readonly paquetes: string | null;
    readonly casos: readonly string[] | null; readonly pasadas: Pasada; readonly maxCasos: number | null; readonly pausaMs: number;
  }
  | { readonly comando: "informe"; readonly salida: string; readonly fuentes: readonly string[]; readonly pares: number | "TODOS"; readonly semilla: number };

export const CODIGOS_ERROR_ARGUMENTOS = Object.freeze([
  "USO", "OPCION_DESCONOCIDA", "ARGUMENTO_SUELTO", "FALTA_VALOR", "OPCION_REPETIDA", "FALTA_MODELO", "FALTA_SALIDA", "SALIDA_RELATIVA", "PAQUETES_RELATIVA",
  "SEMILLA_CON_PAQUETES", "MODELO_INVALIDO", "SEMILLA_INVALIDA", "PASADAS_INVALIDAS", "MAX_CASOS_INVALIDO", "PAUSA_INVALIDA", "FALTAN_FUENTES",
  "FUENTES_INVALIDAS", "PARES_INVALIDOS", "CASOS_INVALIDOS", "CASOS_CON_MAX_CASOS", "NPM_SE_QUEDO",
] as const);
export type CodigoErrorArgumentos = (typeof CODIGOS_ERROR_ARGUMENTOS)[number];

export class ErrorArgumentosEvaluacion extends Error {
  override readonly name = "ErrorArgumentosEvaluacion";
  constructor(readonly codigo: CodigoErrorArgumentos) {
    super(`Argumentos de ia:evaluar: ${codigo}.`);
  }
}

const OPCIONES: Readonly<Record<ArgumentosEvaluacion["comando"], readonly string[]>> = Object.freeze({
  casos: ["--semilla", "--paquetes", "--casos"],
  correr: ["--modelo", "--salida", "--semilla", "--paquetes", "--pasadas", "--max-casos", "--casos", "--pausa-s"],
  informe: ["--salida", "--fuentes", "--pares", "--semilla"],
});

const falla = (codigo: CodigoErrorArgumentos): never => {
  throw new ErrorArgumentosEvaluacion(codigo);
};

function leerOpciones(comando: ArgumentosEvaluacion["comando"], resto: readonly string[]): ReadonlyMap<string, string> {
  const valores = new Map<string, string>();
  for (let i = 0; i < resto.length; i += 2) {
    const opcion = resto[i] as string;
    if (opcion === "--ayuda") falla("USO");
    if (!opcion.startsWith("--")) falla("ARGUMENTO_SUELTO");
    if (!OPCIONES[comando].includes(opcion)) falla("OPCION_DESCONOCIDA");
    const valor = resto[i + 1];
    if (valor === undefined || valor.startsWith("--")) falla("FALTA_VALOR");
    if (valores.has(opcion)) falla("OPCION_REPETIDA");
    valores.set(opcion, valor as string);
  }
  return valores;
}

function entero(texto: string | undefined, min: number, max: number, codigo: CodigoErrorArgumentos): number | null {
  if (texto === undefined) return null;
  const n = /^\d+$/.test(texto) ? Number(texto) : Number.NaN;
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : falla(codigo);
}

const absoluta = (ruta: string | undefined, codigo: CodigoErrorArgumentos): string | null => (ruta === undefined ? null : ruta.startsWith("/") ? ruta : falla(codigo));

/** La semilla: la dada, la de los inventados por omisión, o null si los casos vienen del archivo exportado. */
function semillaYPaquetes(v: ReadonlyMap<string, string>): { readonly semilla: number | null; readonly paquetes: string | null } {
  const paquetes = absoluta(v.get("--paquetes"), "PAQUETES_RELATIVA");
  if (paquetes !== null && v.has("--semilla")) falla("SEMILLA_CON_PAQUETES");
  return { semilla: paquetes === null ? (entero(v.get("--semilla"), 0, MAX_SEMILLA, "SEMILLA_INVALIDA") ?? SEMILLA_INVENTADOS) : null, paquetes };
}

/** Los ids de `--casos`: separados por coma, cada uno con la forma de un id, sin repetir y no más que casos inventados hay. */
function idsDeCasos(texto: string | undefined): readonly string[] | null {
  if (texto === undefined) return null;
  const ids = texto.split(",");
  const validos = ids.length <= MAX_CASOS && ids.every((id) => PATRON_ID_CASO.test(id)) && new Set(ids).size === ids.length;
  return validos ? Object.freeze(ids) : falla("CASOS_INVALIDOS");
}

function correr(v: ReadonlyMap<string, string>): ArgumentosEvaluacion {
  const modelo = v.get("--modelo") ?? falla("FALTA_MODELO");
  // «plantilla» es la línea base en el informe: ningún modelo se llama así.
  if (!PATRON_MODELO.test(modelo) || modelo === FUENTE_PLANTILLA) falla("MODELO_INVALIDO");
  const salida = absoluta(v.get("--salida") ?? falla("FALTA_SALIDA"), "SALIDA_RELATIVA") as string;
  const pasadas = (entero(v.get("--pasadas"), 1, 2, "PASADAS_INVALIDAS") ?? 2) as Pasada;
  const pausa = entero(v.get("--pausa-s"), 0, MAX_PAUSA_MS / MS_POR_SEGUNDO, "PAUSA_INVALIDA");
  const maxCasos = entero(v.get("--max-casos"), 1, MAX_CASOS, "MAX_CASOS_INVALIDO");
  const casos = idsDeCasos(v.get("--casos"));
  if (casos !== null && maxCasos !== null) falla("CASOS_CON_MAX_CASOS");
  return {
    comando: "correr", modelo, salida, ...semillaYPaquetes(v), casos, pasadas, maxCasos,
    pausaMs: pausa === null ? PAUSA_POR_OMISION_MS : pausa * MS_POR_SEGUNDO,
  };
}

function informe(v: ReadonlyMap<string, string>): ArgumentosEvaluacion {
  const salida = absoluta(v.get("--salida") ?? falla("FALTA_SALIDA"), "SALIDA_RELATIVA") as string;
  const fuentes = (v.get("--fuentes") ?? falla("FALTAN_FUENTES")).split(",");
  const validas = fuentes.length >= MIN_FUENTES && fuentes.length <= MAX_FUENTES && new Set(fuentes).size === fuentes.length && fuentes.every((f) => PATRON_MODELO.test(f));
  if (!validas) falla("FUENTES_INVALIDAS");
  const pares = v.get("--pares");
  return {
    comando: "informe", salida, fuentes: Object.freeze(fuentes), semilla: entero(v.get("--semilla"), 0, MAX_SEMILLA, "SEMILLA_INVALIDA") ?? SEMILLA_INVENTADOS,
    pares: pares === "todos" ? "TODOS" : (entero(pares, 1, MAX_PARES, "PARES_INVALIDOS") ?? PARES_POR_OMISION),
  };
}

/** Lee el argv (sin `node` ni el script). `entorno` solo se mira para ver si npm se quedó con una opción (faltó «--»). */
export function leerArgumentosEvaluacion(argv: readonly string[], entorno: Readonly<Record<string, string | undefined>>): ArgumentosEvaluacion {
  const [comando, ...resto] = argv;
  if (comando !== "casos" && comando !== "correr" && comando !== "informe") return falla("USO");
  if (Object.values(OPCIONES).flat().some((o) => entorno[`npm_config_${o.slice(2).replace(/-/g, "_")}`] !== undefined)) falla("NPM_SE_QUEDO");
  const v = leerOpciones(comando, resto);
  if (comando === "casos") return { comando, ...semillaYPaquetes(v), casos: idsDeCasos(v.get("--casos")) };
  return comando === "correr" ? correr(v) : informe(v);
}
