/**
 * La fila de `resumen_ia` (fase E, E3), armada en código puro y sin base: cierra en fallo ANTES de escribir, con un
 * código cerrado y sin repetir lo recibido. El registro es de una corrida por intento de puerta:
 * - PUBLICADO: el modelo respondió, el validador aprobó y el código renderizó el texto;
 * - RECHAZADO: el modelo respondió y el validador rechazó (sus códigos van en `motivos`);
 * - FALLIDO: no hubo salida; `motivo` es uno de MOTIVOS_FALLO y `detalles` sus códigos (el `detalle` del generador o, con
 *   VISTA_NO_CIEGA, los códigos de la guarda). VISTA_NO_CIEGA va sin puerta: no se llamó a ningún generador.
 *
 * tipo, fecha de negocio, hechos, hash y versión salen SIEMPRE del paquete construido (`esPaqueteConstruido`): nadie
 * registra un texto con la clave de otro paquete. La base repite lo esencial con sus CHECK (migración *_resumen_ia).
 * Este módulo no valida el texto contra el paquete (eso es del validador): solo su forma.
 */
import type { Prisma } from "@prisma/client";
import { TIPOS_RESUMEN, type DiaIso, type PaqueteHechos, type TipoResumen } from "../contrato";
import { esDe, esDiaIso, esObjetoPlano, soloCampos, sonDatosPuros, type Registro } from "../formas";
import {
  MAX_SALIDA_CRUDA, MOTIVOS_FALLO, PATRON_MODELO, PATRON_VERSION_PROMPT, PUERTAS,
  type ExitoGeneracion, type MotivoFallo, type Puerta,
} from "../generador";
import { PATRON_HASH } from "../hash";
import { esPaqueteConstruido } from "../paquete";

export const ESTADOS_RESUMEN = Object.freeze(["PUBLICADO", "RECHAZADO", "FALLIDO"] as const);
export type EstadoResumen = (typeof ESTADOS_RESUMEN)[number];

/** Tope de códigos por fila (motivos del validador, o el motivo de fallo y sus detalles). */
export const MAX_MOTIVOS = 32;
/** Un código: mayúsculas y guion bajo, sin dígitos (nunca datos), como PATRON_DETALLE. */
export const PATRON_MOTIVO = /^[A-Z]+(?:_[A-Z]+)*$/;
export const MAX_LARGO_MOTIVO = 64;
/** Tope del texto renderizado (las frases, las presentaciones, el aviso y la lista «fuente · fecha»). */
export const MAX_LARGO_TEXTO = 16_384;
/** Tope del JSON de las opciones del pedido al modelo. */
export const MAX_LARGO_OPCIONES = 4096;
/** El máximo de una columna Int de PostgreSQL. */
export const MAX_ENTERO_COLUMNA = 2_147_483_647;

export const CODIGOS_ERROR_REGISTRO = Object.freeze([
  "PAQUETE_NO_CONSTRUIDO", "ESTADO_INVALIDO", "CAMPO_DESCONOCIDO", "PROMPT_INVALIDO", "VALIDADOR_INVALIDO", "OPCIONES_INVALIDAS",
  "TEXTO_INVALIDO", "EXITO_INVALIDO", "MOTIVOS_INVALIDOS", "PUERTA_INVALIDA", "MODELO_INVALIDO", "LATENCIA_INVALIDA",
  "CLAVE_INVALIDA", "RANGO_INVALIDO", "YA_PUBLICADO", "GUARDADO_INVALIDO",
] as const);
export type CodigoErrorRegistro = (typeof CODIGOS_ERROR_REGISTRO)[number];

/** Entrada o lectura del registro inválida: lanza con el código, sin repetir lo recibido. */
export class ErrorRegistro extends Error {
  override readonly name = "ErrorRegistro";
  constructor(readonly codigo: CodigoErrorRegistro) {
    super(`Registro de resumen rechazado: ${codigo}.`);
  }
}

/** La versión y el hash del prompt del pedido (`PromptConHash` sin el texto: el texto no se guarda, su hash sí). */
export interface PromptRegistrado {
  readonly version: string;
  readonly hash: string;
}

interface EntradaComun {
  readonly paquete: PaqueteHechos;
  readonly prompt: PromptRegistrado;
  /** Las opciones del pedido al modelo (p. ej. `{ temperature: 0, seed: 42 }`): un objeto de datos puros. */
  readonly opciones: Readonly<Record<string, unknown>>;
  /** «validador-v1»: minúsculas con guiones y la versión al final (PATRON_VERSION_PROMPT). */
  readonly validadorVersion: string;
}

export interface EntradaPublicado extends EntradaComun {
  readonly estado: "PUBLICADO";
  readonly exito: ExitoGeneracion;
  /** El texto renderizado por el código (las cifras las pone el render, nunca el modelo). */
  readonly texto: string;
}

export interface EntradaRechazado extends EntradaComun {
  readonly estado: "RECHAZADO";
  readonly exito: ExitoGeneracion;
  /** Los códigos del validador: al menos uno, ninguno de MOTIVOS_FALLO. */
  readonly motivos: readonly string[];
}

export interface EntradaFallido extends EntradaComun {
  readonly estado: "FALLIDO";
  /** Nula solo con VISTA_NO_CIEGA. */
  readonly puerta: Puerta | null;
  readonly motivo: MotivoFallo;
  /** Los códigos que acompañan al motivo (el `detalle` del fallo o los de la guarda); ninguno de MOTIVOS_FALLO. */
  readonly detalles: readonly string[];
  /** El modelo configurado en la puerta, si se sabe (sin digest: no hubo respuesta). */
  readonly modelo?: string | null;
  readonly latenciaMs?: number | null;
}

export type EntradaResumen = EntradaPublicado | EntradaRechazado | EntradaFallido;

/** Los datos de la fila, listos para `resumenIa.create` (sin id ni hora: los ponen Prisma y la base). */
export interface FilaResumen {
  readonly tipo: TipoResumen;
  readonly fechaNegocio: Date;
  readonly estado: EstadoResumen;
  readonly puerta: Puerta | null;
  readonly texto: string | null;
  readonly salidaModelo: string | null;
  /** Copia JSON del paquete construido. */
  readonly hechos: Prisma.InputJsonObject;
  readonly hechosHash: string;
  readonly hechosVersion: string;
  readonly modelo: string | null;
  readonly modeloDigest: string | null;
  readonly opciones: Prisma.InputJsonObject;
  readonly promptVersion: string;
  readonly promptHash: string;
  readonly validadorVersion: string;
  /** Congelada (el tipo es el que pide Prisma). */
  readonly motivos: string[];
  readonly latenciaMs: number | null;
  readonly tokensEntrada: number | null;
  readonly tokensSalida: number | null;
}

/** La clave de un PUBLICADO (resumen_ia_publicado_key). */
export interface ClaveResumen {
  readonly tipo: TipoResumen;
  readonly fechaNegocio: DiaIso;
  readonly hechosHash: string;
  readonly promptHash: string;
  readonly modeloDigest: string;
}

/** La clave revisada, con el día como fecha UTC. */
export interface ClaveLeida {
  readonly tipo: TipoResumen;
  readonly fecha: Date;
  readonly hechosHash: string;
  readonly promptHash: string;
  readonly modeloDigest: string;
}

const CAMPOS_COMUNES = ["estado", "paquete", "prompt", "opciones", "validadorVersion"] as const;
const CAMPOS_POR_ESTADO: Readonly<Record<EstadoResumen, readonly string[]>> = Object.freeze({
  PUBLICADO: Object.freeze([...CAMPOS_COMUNES, "exito", "texto"]),
  RECHAZADO: Object.freeze([...CAMPOS_COMUNES, "exito", "motivos"]),
  FALLIDO: Object.freeze([...CAMPOS_COMUNES, "puerta", "motivo", "detalles", "modelo", "latenciaMs"]),
});
const CAMPOS_EXITO: readonly string[] = Object.freeze(["ok", "puerta", "salidaCruda", "modelo", "modeloDigest", "latenciaMs", "tokensEntrada", "tokensSalida"]);
const CAMPOS_PROMPT: readonly string[] = Object.freeze(["version", "hash"]);
const CAMPOS_CLAVE: readonly string[] = Object.freeze(["tipo", "fechaNegocio", "hechosHash", "promptHash", "modeloDigest"]);
/** Control, formato invisible, sustitutos sueltos y uso privado; el salto de línea sí va (la lista de fuentes). */
const CARACTER_NO_PERMITIDO = /[\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}]|(?![\n])\p{Cc}/u;
const NO_ESPACIO = /\S/;

const exigir = (condicion: boolean, codigo: CodigoErrorRegistro): void => {
  if (!condicion) throw new ErrorRegistro(codigo);
};

const esModelo = (valor: unknown): valor is string => typeof valor === "string" && PATRON_MODELO.test(valor);
const esEnteroColumna = (valor: unknown): valor is number => typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= MAX_ENTERO_COLUMNA;
const esEnteroONulo = (valor: unknown): valor is number | null => valor === null || esEnteroColumna(valor);

/** Un día ISO como medianoche UTC (así lo guarda y lo devuelve Prisma en una columna @db.Date). */
export function fechaDeDia(dia: DiaIso): Date {
  return new Date(`${dia}T00:00:00.000Z`);
}

/** El día ISO de una fecha @db.Date (medianoche UTC). */
export function diaDeFecha(fecha: Date): DiaIso {
  return fecha.toISOString().slice(0, 10);
}

function revisarPrompt(prompt: unknown): PromptRegistrado {
  exigir(esObjetoPlano(prompt) && soloCampos(prompt, CAMPOS_PROMPT), "PROMPT_INVALIDO");
  const { version, hash } = prompt as Registro;
  exigir(typeof version === "string" && PATRON_VERSION_PROMPT.test(version) && typeof hash === "string" && PATRON_HASH.test(hash), "PROMPT_INVALIDO");
  return { version: version as string, hash: hash as string };
}

function revisarOpciones(opciones: unknown): Prisma.InputJsonObject {
  exigir(sonDatosPuros(opciones) && esObjetoPlano(opciones), "OPCIONES_INVALIDAS");
  const texto = JSON.stringify(opciones);
  exigir(Buffer.byteLength(texto, "utf8") <= MAX_LARGO_OPCIONES, "OPCIONES_INVALIDAS");
  return Object.freeze(JSON.parse(texto) as Prisma.InputJsonObject);
}

function revisarTexto(texto: unknown): string {
  const valido = typeof texto === "string" && texto.length <= MAX_LARGO_TEXTO && NO_ESPACIO.test(texto) && texto.isWellFormed() && !CARACTER_NO_PERMITIDO.test(texto);
  exigir(valido, "TEXTO_INVALIDO");
  return texto as string;
}

/** Los campos de un éxito del generador, revisados (no se confía en el tipo: llega del orquestador). */
function revisarExito(exito: unknown): ExitoGeneracion {
  exigir(esObjetoPlano(exito) && soloCampos(exito, CAMPOS_EXITO), "EXITO_INVALIDO");
  const e = exito as Registro;
  const valido = e.ok === true && esDe(PUERTAS, e.puerta) && typeof e.salidaCruda === "string" && e.salidaCruda.length <= MAX_SALIDA_CRUDA
    && esModelo(e.modelo) && esModelo(e.modeloDigest) && esEnteroColumna(e.latenciaMs) && esEnteroONulo(e.tokensEntrada) && esEnteroONulo(e.tokensSalida);
  exigir(valido, "EXITO_INVALIDO");
  return e as unknown as ExitoGeneracion;
}

/** Códigos únicos, con forma y con tope; `sinFallos`: ninguno de MOTIVOS_FALLO. */
function revisarCodigos(codigos: unknown, minimo: number, sinFallos: boolean): readonly string[] {
  exigir(Array.isArray(codigos) && sonDatosPuros(codigos), "MOTIVOS_INVALIDOS");
  const lista = Array.from(codigos as readonly unknown[]);
  const valido = lista.length >= minimo && lista.length <= MAX_MOTIVOS && new Set(lista).size === lista.length
    && lista.every((c) => typeof c === "string" && c.length <= MAX_LARGO_MOTIVO && PATRON_MOTIVO.test(c) && !(sinFallos && esDe(MOTIVOS_FALLO, c)));
  exigir(valido, "MOTIVOS_INVALIDOS");
  return lista as string[];
}

function camposDelPaquete(paquete: unknown): Pick<FilaResumen, "tipo" | "fechaNegocio" | "hechos" | "hechosHash" | "hechosVersion"> {
  exigir(esPaqueteConstruido(paquete), "PAQUETE_NO_CONSTRUIDO");
  const p = paquete as PaqueteHechos;
  return { tipo: p.tipo, fechaNegocio: fechaDeDia(p.hoy), hechos: JSON.parse(JSON.stringify(p)) as Prisma.InputJsonObject, hechosHash: p.hash, hechosVersion: p.version };
}

type Resto = Pick<FilaResumen, "puerta" | "texto" | "salidaModelo" | "modelo" | "modeloDigest" | "latenciaMs" | "tokensEntrada" | "tokensSalida"> & { readonly motivos: readonly string[] };

function restoConExito(exito: unknown, texto: string | null, motivos: readonly string[]): Resto {
  const e = revisarExito(exito);
  return { puerta: e.puerta, texto, salidaModelo: e.salidaCruda, modelo: e.modelo, modeloDigest: e.modeloDigest, motivos, latenciaMs: e.latenciaMs, tokensEntrada: e.tokensEntrada, tokensSalida: e.tokensSalida };
}

function restoDeFallo(r: Registro): Resto {
  exigir(esDe(MOTIVOS_FALLO, r.motivo), "MOTIVOS_INVALIDOS");
  const detalles = revisarCodigos(r.detalles, 0, true);
  exigir(detalles.length < MAX_MOTIVOS, "MOTIVOS_INVALIDOS");
  const vista = r.motivo === "VISTA_NO_CIEGA";
  exigir(vista ? r.puerta === null : esDe(PUERTAS, r.puerta), "PUERTA_INVALIDA");
  const modelo = r.modelo ?? null;
  exigir(modelo === null || esModelo(modelo), "MODELO_INVALIDO");
  const latenciaMs = r.latenciaMs ?? null;
  exigir(esEnteroONulo(latenciaMs), "LATENCIA_INVALIDA");
  return {
    puerta: vista ? null : (r.puerta as Puerta), texto: null, salidaModelo: null, modelo: modelo as string | null, modeloDigest: null,
    motivos: [r.motivo as MotivoFallo, ...detalles], latenciaMs: latenciaMs as number | null, tokensEntrada: null, tokensSalida: null,
  };
}

function restoPorEstado(r: Registro): Resto {
  if (r.estado === "PUBLICADO") return restoConExito(r.exito, revisarTexto(r.texto), []);
  if (r.estado === "RECHAZADO") return restoConExito(r.exito, null, revisarCodigos(r.motivos, 1, true));
  return restoDeFallo(r);
}

/**
 * La fila de una corrida, validada y congelada. Orden: la forma de la entrada (el estado y sus campos), el paquete, el
 * prompt, la versión del validador, las opciones y lo propio del estado. No cambia la entrada: todo es copia.
 */
export function filaDeResumen(entrada: EntradaResumen): FilaResumen {
  const crudo: unknown = entrada;
  exigir(esObjetoPlano(crudo), "ESTADO_INVALIDO");
  const r = crudo as Registro;
  exigir(esDe(ESTADOS_RESUMEN, r.estado), "ESTADO_INVALIDO");
  exigir(soloCampos(r, CAMPOS_POR_ESTADO[r.estado as EstadoResumen]), "CAMPO_DESCONOCIDO");
  const delPaquete = camposDelPaquete(r.paquete);
  const prompt = revisarPrompt(r.prompt);
  exigir(typeof r.validadorVersion === "string" && PATRON_VERSION_PROMPT.test(r.validadorVersion), "VALIDADOR_INVALIDO");
  const opciones = revisarOpciones(r.opciones);
  const resto = restoPorEstado(r);
  return Object.freeze({
    ...delPaquete,
    estado: r.estado as EstadoResumen,
    ...resto,
    motivos: Object.freeze([...resto.motivos]) as string[],
    opciones,
    promptVersion: prompt.version,
    promptHash: prompt.hash,
    validadorVersion: r.validadorVersion as string,
  });
}

/** La clave de un PUBLICADO, revisada: tipo de la lista, día que existe, hashes sha256 y digest con forma. */
export function leerClave(clave: ClaveResumen): ClaveLeida {
  const crudo: unknown = clave;
  exigir(esObjetoPlano(crudo) && soloCampos(crudo, CAMPOS_CLAVE), "CLAVE_INVALIDA");
  const c = crudo as Registro;
  const valida = esDe(TIPOS_RESUMEN, c.tipo) && typeof c.fechaNegocio === "string" && esDiaIso(c.fechaNegocio)
    && typeof c.hechosHash === "string" && PATRON_HASH.test(c.hechosHash) && typeof c.promptHash === "string" && PATRON_HASH.test(c.promptHash)
    && esModelo(c.modeloDigest);
  exigir(valida, "CLAVE_INVALIDA");
  return Object.freeze({
    tipo: c.tipo as TipoResumen, fecha: fechaDeDia(c.fechaNegocio as string), hechosHash: c.hechosHash as string, promptHash: c.promptHash as string, modeloDigest: c.modeloDigest as string,
  });
}
