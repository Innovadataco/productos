/**
 * Los pares a ciegas para Jelk (E7): por caso, dos textos de fuentes distintas (dos modelos, o un modelo y la plantilla
 * sin IA), para calificar la claridad de cada uno de 1 a 5.
 * - Con una cantidad: casos distintos, repartidos por tipo en turno (DIARIO, REGLAS, ESCENARIOS…), y para cada caso un
 *   par de fuentes al azar. Con «TODOS»: todos los pares de fuentes de todos los casos.
 * - El orden de los pares y el de A y B van al azar con la semilla (`crearPrng`), con los lados balanceados (cada par de
 *   fuentes sale la mitad de las veces de cada lado); la clave (qué fuente es A y cuál B)
 *   va en un archivo aparte; el archivo de pares no nombra ninguna fuente.
 * Un caso sin texto de alguna fuente (no publicó) queda sin par, y la clave dice cuál faltó.
 */
import { TIPOS_RESUMEN, type TipoResumen } from "../contrato";
import { crearPrng, type Prng } from "../../proyecciones/prng";

export const MIN_FUENTES = 2;
export const MAX_FUENTES = 4;
const MAX_PARES = 30;

export const CODIGOS_ERROR_PARES = Object.freeze(["FUENTES_INSUFICIENTES", "FUENTE_REPETIDA", "CANTIDAD_INVALIDA"] as const);
export type CodigoErrorPares = (typeof CODIGOS_ERROR_PARES)[number];

export class ErrorPares extends Error {
  override readonly name = "ErrorPares";
  constructor(readonly codigo: CodigoErrorPares) {
    super(`Pares a ciegas: ${codigo}.`);
  }
}

export interface CasoDePar {
  readonly id: string;
  readonly tipo: TipoResumen;
}

export interface TextosDeFuente {
  /** Un modelo («qwen2.5:14b») o «plantilla». Nunca sale en el archivo de pares. */
  readonly fuente: string;
  /** El texto publicado por caso. */
  readonly textos: ReadonlyMap<string, string>;
}

export interface OpcionesPares {
  readonly casos: readonly CasoDePar[];
  readonly fuentes: readonly TextosDeFuente[];
  readonly cantidad: number | "TODOS";
  readonly semilla: number;
}

export interface LadoDelPar {
  readonly fuente: string;
  readonly texto: string;
}

export interface Par {
  readonly numero: number;
  readonly caso: string;
  readonly tipo: TipoResumen;
  readonly a: LadoDelPar;
  readonly b: LadoDelPar;
}

export interface ResultadoPares {
  readonly pares: readonly Par[];
  readonly sinPar: readonly { readonly caso: string; readonly faltan: readonly string[] }[];
}

interface Candidato {
  readonly caso: CasoDePar;
  readonly fuentes: readonly [TextosDeFuente, TextosDeFuente];
}

function mezclar<T>(p: Prng, lista: readonly T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = p.enteroMenorQue(i + 1);
    [copia[i], copia[j]] = [copia[j] as T, copia[i] as T];
  }
  return copia;
}

function revisar(o: OpcionesPares): void {
  if (o.fuentes.length < MIN_FUENTES || o.fuentes.length > MAX_FUENTES) throw new ErrorPares("FUENTES_INSUFICIENTES");
  if (new Set(o.fuentes.map((f) => f.fuente)).size !== o.fuentes.length) throw new ErrorPares("FUENTE_REPETIDA");
  if (o.cantidad !== "TODOS" && (!Number.isInteger(o.cantidad) || o.cantidad < 1 || o.cantidad > MAX_PARES)) throw new ErrorPares("CANTIDAD_INVALIDA");
}

/** Todos los pares de fuentes (en el orden dado) de un caso. */
const combinaciones = (fuentes: readonly TextosDeFuente[]): readonly (readonly [TextosDeFuente, TextosDeFuente])[] =>
  fuentes.flatMap((f, i) => fuentes.slice(i + 1).map((g) => [f, g] as const));

/** Con una cantidad: un candidato por caso, casos en turno por tipo, hasta la cantidad. */
function muestra(p: Prng, porCaso: readonly (readonly Candidato[])[], cantidad: number): Candidato[] {
  const colas = TIPOS_RESUMEN.map((tipo) => mezclar(p, porCaso.filter((c) => c[0]?.caso.tipo === tipo)));
  const elegidos: Candidato[] = [];
  while (elegidos.length < cantidad && colas.some((c) => c.length > 0)) {
    for (const cola of colas) {
      const delCaso = cola.shift();
      if (delCaso !== undefined && elegidos.length < cantidad) elegidos.push(delCaso[p.enteroMenorQue(delCaso.length)] as Candidato);
    }
  }
  return elegidos;
}

export function armarPares(o: OpcionesPares): ResultadoPares {
  revisar(o);
  const p = crearPrng(o.semilla);
  const sinPar = o.casos.flatMap((caso) => {
    const faltan = o.fuentes.filter((f) => !f.textos.has(caso.id)).map((f) => f.fuente);
    return faltan.length > 0 ? [Object.freeze({ caso: caso.id, faltan: Object.freeze(faltan) })] : [];
  });
  const completos = o.casos.filter((c) => o.fuentes.every((f) => f.textos.has(c.id)));
  const porCaso = completos.map((caso) => combinaciones(o.fuentes).map((fuentes): Candidato => ({ caso, fuentes })));
  const elegidos = o.cantidad === "TODOS" ? porCaso.flat() : muestra(p, porCaso, o.cantidad);
  // Los lados, balanceados: en cada par va en A la fuente que menos veces fue A hasta ahí (empates al azar).
  const vecesEnA = new Map<string, number>();
  const pares = mezclar(p, elegidos).map((c, i): Par => {
    const [f, g] = c.fuentes;
    const nf = vecesEnA.get(f.fuente) ?? 0;
    const ng = vecesEnA.get(g.fuente) ?? 0;
    const [x, y] = nf < ng || (nf === ng && p.enteroMenorQue(2) === 0) ? [f, g] : [g, f];
    vecesEnA.set(x.fuente, (vecesEnA.get(x.fuente) ?? 0) + 1);
    const lado = (f: TextosDeFuente): LadoDelPar => Object.freeze({ fuente: f.fuente, texto: f.textos.get(c.caso.id) as string });
    return Object.freeze({ numero: i + 1, caso: c.caso.id, tipo: c.caso.tipo, a: lado(x), b: lado(y) });
  });
  return Object.freeze({ pares: Object.freeze(pares), sinPar: Object.freeze(sinPar) });
}

const NOMBRE_DEL_TIPO: Readonly<Record<TipoResumen, string>> = Object.freeze({ DIARIO: "resumen del día", REGLAS: "resumen del plan", ESCENARIOS: "resumen de los escenarios", SIMULACION: "resumen de la simulación" });

/** El archivo para calificar: los textos A y B de cada par y el formato de 1 a 5, sin ninguna fuente. */
export function paresEnMarkdown(pares: readonly Par[]): string {
  const cabecera = [
    "# Pares a ciegas · claridad de los resúmenes",
    "",
    "Cada par trae dos redacciones del mismo resumen. Las cifras las pone el sistema en las dos. Califique la claridad de cada texto de 1 a 5 (1: confuso; 5: muy claro), sin buscar cuál es «mejor».",
    "",
  ];
  const cuerpo = pares.flatMap((par) => [
    `## Par ${par.numero} · ${NOMBRE_DEL_TIPO[par.tipo]}`, "", "**Texto A**", "", par.a.texto, "", "Claridad de A (1 a 5): ___", "",
    "**Texto B**", "", par.b.texto, "", "Claridad de B (1 a 5): ___", "",
  ]);
  return `${[...cabecera, ...cuerpo].join("\n")}`;
}

/** ¿Nombra el texto alguna de las fuentes (sin distinguir mayúsculas)? Para probar que el archivo de pares es ciego. */
export function nombraFuentes(texto: string, fuentes: readonly string[]): boolean {
  const minusculas = texto.toLowerCase();
  return fuentes.some((f) => minusculas.includes(f.toLowerCase()));
}

export interface ClavePares {
  readonly semilla: number;
  readonly pares: readonly { readonly par: number; readonly caso: string; readonly tipo: TipoResumen; readonly a: string; readonly b: string }[];
  readonly sinPar: ResultadoPares["sinPar"];
}

/** La clave, aparte del archivo de pares: qué fuente es A y cuál B en cada par. */
export function claveDePares(r: ResultadoPares, semilla: number): ClavePares {
  return Object.freeze({
    semilla,
    pares: Object.freeze(r.pares.map((p) => Object.freeze({ par: p.numero, caso: p.caso, tipo: p.tipo, a: p.a.fuente, b: p.b.fuente }))),
    sinPar: r.sinPar,
  });
}
