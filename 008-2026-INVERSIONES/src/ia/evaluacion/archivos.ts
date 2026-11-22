/**
 * Los archivos de una evaluación (E7), en la carpeta de resultados (salida.ts). Cada línea JSON lleva `linea` (qué es):
 * - `corridas-<modelo>.jsonl`: la CABECERA (modelo, origen de los casos, su hash, pasadas y límite), una CORRIDA por
 *   línea apenas termina y, al final, el FIN con el conteo de la red vigilada. Sin el fin, la evaluación se cortó;
 * - `plantilla.jsonl`: la CABECERA y una PLANTILLA por caso (la línea base: la plantilla sin IA por el mismo validador),
 *   escrita una vez; si ya está, tiene que ser de los MISMOS casos (CASOS_DISTINTOS);
 * - el informe (metricas.json, metricas.md, pares-a-ciegas.md y clave-pares.json) lo escribe informe.ts.
 * Al leer, cada línea se revisa: lo que no tiene la forma esperada es ARCHIVO_INVALIDO.
 */
import { TIPOS_RESUMEN } from "../contrato";
import { esDe, esObjetoPlano, type Registro } from "../formas";
import { resumenSinIa } from "../validador/plantilla";
import { hashDeCasos } from "./casos";
import type { ConteoRed } from "./red";
import { nombreDeModelo, type Carpeta } from "./salida";
import { ESTADOS_CORRIDA, ESTADOS_FIN, ORIGENES_CASOS, type CasoEvaluacion, type FinEvaluacion, type OrigenCasos, type RegistroCorrida, type RegistroPlantilla } from "./tipos";

export const VERSION_ARCHIVOS = "evaluacion-v1";

export const ARCHIVOS = Object.freeze({
  plantilla: "plantilla.jsonl",
  metricasJson: "metricas.json",
  metricasMd: "metricas.md",
  pares: "pares-a-ciegas.md",
  clave: "clave-pares.json",
});

export const archivoDeCorridas = (modelo: string): string => `corridas-${nombreDeModelo(modelo)}.jsonl`;

export const CODIGOS_ERROR_ARCHIVOS = Object.freeze(["SIN_CORRIDAS", "SIN_PLANTILLA", "CASOS_DISTINTOS", "ARCHIVO_INVALIDO"] as const);
export type CodigoErrorArchivos = (typeof CODIGOS_ERROR_ARCHIVOS)[number];

export class ErrorArchivos extends Error {
  override readonly name = "ErrorArchivos";
  constructor(readonly codigo: CodigoErrorArchivos) {
    super(`Archivos de la evaluación: ${codigo}.`);
  }
}

export interface CabeceraCorridas {
  readonly modelo: string;
  readonly origen: OrigenCasos;
  readonly casosHash: string;
  readonly pasadas: number;
  readonly limiteMs: number;
}

export type FinConRed = FinEvaluacion & { readonly red: ConteoRed };

export interface CorridasAbiertas {
  anotar(registro: RegistroCorrida): void;
  terminar(fin: FinEvaluacion, red: ConteoRed): void;
}

export interface CorridasLeidas {
  readonly cabecera: CabeceraCorridas;
  readonly registros: readonly RegistroCorrida[];
  readonly fin: FinConRed | null;
}

export interface PlantillaLeida {
  readonly origen: OrigenCasos;
  readonly casosHash: string;
  readonly registros: readonly RegistroPlantilla[];
}

/** El archivo de corridas del modelo, nuevo (si ya existe: ARCHIVO_EXISTE de la carpeta). */
export function abrirCorridas(carpeta: Carpeta, cabecera: CabeceraCorridas): CorridasAbiertas {
  const jsonl = carpeta.crearJsonl(archivoDeCorridas(cabecera.modelo));
  jsonl.anotar({ linea: "CABECERA", version: VERSION_ARCHIVOS, ...cabecera });
  return Object.freeze({
    anotar: (registro: RegistroCorrida): void => jsonl.anotar({ linea: "CORRIDA", ...registro }),
    terminar: (fin: FinEvaluacion, red: ConteoRed): void => {
      jsonl.anotar({ linea: "FIN", ...fin, red });
      jsonl.cerrar();
    },
  });
}

const esLinea = (v: unknown, linea: string): v is Registro => esObjetoPlano(v) && v.linea === linea;

const esCabecera = (v: unknown): v is Registro =>
  esLinea(v, "CABECERA") && v.version === VERSION_ARCHIVOS && typeof v.casosHash === "string" && esDe(ORIGENES_CASOS, v.origen);

const esCorrida = (v: unknown): v is Registro =>
  esLinea(v, "CORRIDA") && typeof v.caso === "string" && esDe(TIPOS_RESUMEN, v.tipo) && esDe(ESTADOS_CORRIDA, v.estado) && (v.pasada === 1 || v.pasada === 2)
  && Array.isArray(v.motivos) && (v.texto === null || typeof v.texto === "string") && typeof v.duracionMs === "number"
  && (v.latenciaMs === null || typeof v.latenciaMs === "number");

const esPlantilla = (v: unknown): v is Registro =>
  esLinea(v, "PLANTILLA") && typeof v.caso === "string" && esDe(TIPOS_RESUMEN, v.tipo) && (v.estado === "PUBLICADO" || v.estado === "RECHAZADO")
  && (v.texto === null || typeof v.texto === "string");

/** La línea sin su marca `linea`. */
function sinMarca<T>(v: Registro): T {
  const { linea: _marca, ...resto } = v;
  return Object.freeze(resto) as T;
}

export function leerPlantilla(carpeta: Carpeta): PlantillaLeida {
  if (!carpeta.existe(ARCHIVOS.plantilla)) throw new ErrorArchivos("SIN_PLANTILLA");
  const [cabecera, ...resto] = carpeta.leerJsonl(ARCHIVOS.plantilla);
  if (!esCabecera(cabecera) || !resto.every(esPlantilla)) throw new ErrorArchivos("ARCHIVO_INVALIDO");
  return Object.freeze({
    origen: cabecera.origen as OrigenCasos, casosHash: cabecera.casosHash as string,
    registros: Object.freeze((resto as Registro[]).map((l) => sinMarca<RegistroPlantilla>(l))),
  });
}

/** La plantilla sin IA de los casos, una vez por carpeta. */
export function escribirPlantilla(carpeta: Carpeta, casos: readonly CasoEvaluacion[], origen: OrigenCasos): void {
  const casosHash = hashDeCasos(casos);
  if (carpeta.existe(ARCHIVOS.plantilla)) {
    if (leerPlantilla(carpeta).casosHash !== casosHash) throw new ErrorArchivos("CASOS_DISTINTOS");
    return;
  }
  const jsonl = carpeta.crearJsonl(ARCHIVOS.plantilla);
  jsonl.anotar({ linea: "CABECERA", version: VERSION_ARCHIVOS, origen, casosHash, casos: casos.length });
  for (const c of casos) {
    const r = resumenSinIa(c.paquete);
    const registro: RegistroPlantilla = r.ok
      ? { caso: c.id, tipo: c.tipo, estado: "PUBLICADO", motivos: [], texto: r.resumen.texto }
      : { caso: c.id, tipo: c.tipo, estado: "RECHAZADO", motivos: r.motivos, texto: null };
    jsonl.anotar({ linea: "PLANTILLA", ...registro });
  }
  jsonl.cerrar();
}

export function leerCorridas(carpeta: Carpeta, modelo: string): CorridasLeidas {
  const nombre = archivoDeCorridas(modelo);
  if (!carpeta.existe(nombre)) throw new ErrorArchivos("SIN_CORRIDAS");
  const [cabecera, ...resto] = carpeta.leerJsonl(nombre);
  if (!esCabecera(cabecera) || cabecera.modelo !== modelo) throw new ErrorArchivos("ARCHIVO_INVALIDO");
  const ultima = resto.at(-1);
  const fin = esLinea(ultima, "FIN") && esDe(ESTADOS_FIN, ultima.estado) ? sinMarca<FinConRed>(ultima) : null;
  const corridas = fin === null ? resto : resto.slice(0, -1);
  if (!corridas.every(esCorrida)) throw new ErrorArchivos("ARCHIVO_INVALIDO");
  return Object.freeze({
    cabecera: sinMarca<CabeceraCorridas>(cabecera),
    registros: Object.freeze((corridas as Registro[]).map((l) => sinMarca<RegistroCorrida>(l))),
    fin,
  });
}
