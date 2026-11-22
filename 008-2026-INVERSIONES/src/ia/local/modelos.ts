/**
 * Modelos aprobados de la puerta local: los publica PI (no son un literal del código). PI mantiene el archivo
 * `modelos-ia-local-permitidos.json` en un directorio compartido que 008 monta de solo lectura; la ruta del directorio
 * llega por la variable `INV_IA_DIR_COMPARTIDA` (su valor va en el archivo de producción, nunca en el repo). Antes de
 * cada generación, `/api/tags` debe mostrar el modelo con el digest DE LA LISTA (si alguien cambia los pesos con el
 * mismo nombre, la puerta cierra).
 *
 * El archivo, de esquema CERRADO (versión 1):
 *   { "version": 1, "publicadoPor": "<quién>", "fecha": "AAAA-MM-DD",
 *     "modelos": [ { "nombre": "<nombre>:<etiqueta>", "digest": "<64 hex en minúsculas>", "nota": "<opcional>" } ] }
 * Sin IP, puerto, URL ni registro: ni en los nombres ni en los textos. El digest es obligatorio (PI lo midió).
 *
 * El fallo es BLANDO («PI no debe poder tumbar a 008, solo deshabilitar la selección»): si falta la variable, falta el
 * archivo, no pasa el esquema o la versión no se conoce, nada lanza; la lista queda VACÍA (nunca una inventada), la
 * puerta local queda «sin lista de PI» con su motivo y se registra solo el motivo (sin la ruta ni el contenido).
 *
 * La lista se lee UNA vez, al cargar el módulo (una por proceso): si PI la cambia, se reinicia el servicio. No hay punto
 * de inyección: ningún otro módulo de la puerta local recibe otra lista ni lee el entorno o el disco (lo cuida
 * tests/unit/ia/local/candados.test.ts); en las pruebas, el módulo se recarga con la variable o se reemplaza con `vi.mock`.
 */
import { closeSync, fstatSync, openSync, readFileSync } from "node:fs";
import path from "node:path";
import { esDiaIso, esObjetoPlano, soloCampos } from "../formas";

export interface ModeloAprobado {
  readonly nombre: string;
  /**
   * sha256 en hexadecimal (64, minúsculas). La lista de PI lo exige (nunca null); el tipo admite null por compatibilidad
   * con la puerta local de E4a, que con null responde DIGEST_POR_VERIFICAR sin tocar la red.
   */
  readonly digest: string | null;
  /** La nota de PI, si la trae (texto corto, sin direcciones). */
  readonly nota?: string;
}

export const PATRON_DIGEST = /^[0-9a-f]{64}$/;

/** La variable con la ruta ABSOLUTA del directorio compartido con PI (montado de solo lectura). */
export const VARIABLE_DIR_COMPARTIDA = "INV_IA_DIR_COMPARTIDA";
/** El archivo que PI publica dentro de ese directorio. */
export const ARCHIVO_LISTA_PI = "modelos-ia-local-permitidos.json";
/** Las versiones del esquema que esta versión de 008 entiende. Otra versión: «sin lista de PI». */
export const VERSIONES_LISTA_PI: readonly number[] = Object.freeze([1]);
export const MAX_BYTES_LISTA_PI = 65_536;
export const MAX_MODELOS_LISTA_PI = 32;
export const MAX_LARGO_NOTA_PI = 200;
export const MAX_LARGO_PUBLICADO_POR = 64;

export const MOTIVOS_SIN_LISTA = Object.freeze([
  "SIN_VARIABLE", "RUTA_INVALIDA", "ARCHIVO_AUSENTE", "ARCHIVO_ILEGIBLE", "ARCHIVO_DEMASIADO_GRANDE", "JSON_INVALIDO", "ESQUEMA_INVALIDO", "VERSION_DESCONOCIDA",
] as const);
export type MotivoSinLista = (typeof MOTIVOS_SIN_LISTA)[number];

export type ListaModelosPi =
  | { readonly estado: "LISTA"; readonly version: number; readonly publicadoPor: string; readonly fecha: string; readonly modelos: readonly ModeloAprobado[] }
  | { readonly estado: "SIN_LISTA"; readonly motivo: MotivoSinLista };

export type LecturaArchivo = { readonly ok: true; readonly texto: string } | { readonly ok: false; readonly motivo: "ARCHIVO_AUSENTE" | "ARCHIVO_ILEGIBLE" | "ARCHIVO_DEMASIADO_GRANDE" };

/**
 * «qwen2.5:14b»: nombre y etiqueta explícita, en minúsculas; sin barras (ni registro ni host). La CHECK de `config_ia`
 * repite este patrón (tests/unit/ia/config/esquema.test.ts).
 */
export const PATRON_NOMBRE_MODELO_LOCAL = /^[a-z0-9][a-z0-9._-]{0,63}:[a-z0-9][a-z0-9._-]{0,63}$/;
const PATRON_NOMBRE = PATRON_NOMBRE_MODELO_LOCAL;
const PATRON_PUBLICADO_POR = /^[\p{L}\p{N}][\p{L}\p{N} ().,_-]*$/u;
/**
 * Una dirección escrita: una IPv4, un puerto («:47213» suelto, no pegado a una palabra: «1:1» o «10:30» no lo son), una
 * IPv6 entre corchetes o un esquema de URL.
 */
const DIRECCION = /\d{1,3}(?:\.\d{1,3}){3}|(?<![\w.]):\d{1,5}(?![\w.])|\[[0-9a-f:]*:[0-9a-f:]*\]|:\/\//i;
/** Control, formato invisible, sustitutos sueltos, uso privado y separadores de línea. */
const CARACTER_NO_PERMITIDO = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}]/u;
const CAMPOS_LISTA: readonly string[] = Object.freeze(["version", "publicadoPor", "fecha", "modelos"]);
const CAMPOS_MODELO: readonly string[] = Object.freeze(["nombre", "digest", "nota"]);

const sinLista = (motivo: MotivoSinLista): ListaModelosPi => Object.freeze({ estado: "SIN_LISTA", motivo });
const sinDireccion = (texto: string): boolean => !DIRECCION.test(texto);

const textoCorto = (valor: unknown, maximo: number): valor is string =>
  typeof valor === "string" && valor.length > 0 && valor.length <= maximo && valor.isWellFormed() && !CARACTER_NO_PERMITIDO.test(valor) && sinDireccion(valor);

/** Un modelo de la lista, revisado y congelado; null si no cumple el esquema. */
function modeloDeLista(crudo: unknown): ModeloAprobado | null {
  if (!esObjetoPlano(crudo) || !soloCampos(crudo, CAMPOS_MODELO)) return null;
  const { nombre, digest, nota } = crudo;
  const valido = typeof nombre === "string" && PATRON_NOMBRE.test(nombre) && sinDireccion(nombre) && !/:\d+$/.test(nombre)
    && typeof digest === "string" && PATRON_DIGEST.test(digest)
    && (nota === undefined || textoCorto(nota, MAX_LARGO_NOTA_PI));
  if (!valido) return null;
  return Object.freeze(nota === undefined ? { nombre, digest } : { nombre, digest, nota: nota as string });
}

function modelosDeLista(crudos: unknown): readonly ModeloAprobado[] | null {
  if (!Array.isArray(crudos) || crudos.length > MAX_MODELOS_LISTA_PI) return null;
  const modelos = (crudos as readonly unknown[]).map(modeloDeLista);
  if (modelos.some((m) => m === null)) return null;
  const nombres = new Set(modelos.map((m) => (m as ModeloAprobado).nombre));
  return nombres.size === modelos.length ? Object.freeze(modelos as ModeloAprobado[]) : null;
}

function revisarLista(datos: unknown): ListaModelosPi {
  if (!esObjetoPlano(datos) || !Object.hasOwn(datos, "version")) return sinLista("ESQUEMA_INVALIDO");
  const { version } = datos;
  if (typeof version !== "number" || !VERSIONES_LISTA_PI.includes(version)) return sinLista("VERSION_DESCONOCIDA");
  if (!soloCampos(datos, CAMPOS_LISTA)) return sinLista("ESQUEMA_INVALIDO");
  const { publicadoPor, fecha } = datos;
  const modelos = modelosDeLista(datos.modelos);
  const valido = textoCorto(publicadoPor, MAX_LARGO_PUBLICADO_POR) && PATRON_PUBLICADO_POR.test(publicadoPor)
    && typeof fecha === "string" && esDiaIso(fecha) && modelos !== null;
  if (!valido) return sinLista("ESQUEMA_INVALIDO");
  return Object.freeze({ estado: "LISTA", version, publicadoPor, fecha, modelos });
}

/**
 * La lista de PI desde el texto del archivo (`undefined`: el archivo no está). Pura y nunca lanza: lo que no cumpla el
 * esquema cerrado da «sin lista» con su motivo.
 */
export function leerModelosPermitidos(fuente: string | undefined): ListaModelosPi {
  if (fuente === undefined) return sinLista("ARCHIVO_AUSENTE");
  if (typeof fuente !== "string") return sinLista("ARCHIVO_ILEGIBLE");
  let datos: unknown;
  try {
    datos = JSON.parse(fuente);
  } catch {
    return sinLista("JSON_INVALIDO");
  }
  return revisarLista(datos);
}

const codigoDe = (error: unknown): unknown => (typeof error === "object" && error !== null ? (error as { readonly code?: unknown }).code : undefined);

/** El archivo, con un tope de bytes y en UTF-8 estricto. No lanza. */
export function leerArchivoAcotado(ruta: string): LecturaArchivo {
  let descriptor: number;
  try {
    descriptor = openSync(ruta, "r");
  } catch (error) {
    const codigo = codigoDe(error);
    return { ok: false, motivo: codigo === "ENOENT" || codigo === "ENOTDIR" ? "ARCHIVO_AUSENTE" : "ARCHIVO_ILEGIBLE" };
  }
  try {
    const estado = fstatSync(descriptor);
    if (!estado.isFile()) return { ok: false, motivo: "ARCHIVO_ILEGIBLE" };
    if (estado.size > MAX_BYTES_LISTA_PI) return { ok: false, motivo: "ARCHIVO_DEMASIADO_GRANDE" };
    const bytes = readFileSync(descriptor);
    if (bytes.byteLength > MAX_BYTES_LISTA_PI) return { ok: false, motivo: "ARCHIVO_DEMASIADO_GRANDE" };
    return { ok: true, texto: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, motivo: "ARCHIVO_ILEGIBLE" };
  } finally {
    closeSync(descriptor);
  }
}

/** Una ruta absoluta, sin NUL y ya normalizada (sin «..» ni barras dobles). */
const rutaValida = (valor: string): boolean => !valor.includes("\u0000") && path.isAbsolute(valor) && path.normalize(valor) === valor;

/**
 * La lista desde el entorno: el directorio de `INV_IA_DIR_COMPARTIDA` y, dentro, el archivo de PI. Nunca lanza (fallo
 * blando); `leer` se inyecta solo en las pruebas.
 */
export function cargarModelosPermitidos(entorno: Readonly<Record<string, string | undefined>>, leer: (ruta: string) => LecturaArchivo = leerArchivoAcotado): ListaModelosPi {
  try {
    const dir = entorno[VARIABLE_DIR_COMPARTIDA];
    if (dir === undefined || dir === "") return sinLista("SIN_VARIABLE");
    if (typeof dir !== "string" || !rutaValida(dir)) return sinLista("RUTA_INVALIDA");
    const lectura = leer(path.join(dir, ARCHIVO_LISTA_PI));
    return lectura.ok ? leerModelosPermitidos(lectura.texto) : sinLista(lectura.motivo);
  } catch {
    return sinLista("ARCHIVO_ILEGIBLE");
  }
}

function cargarAlArrancar(): ListaModelosPi {
  const lista = cargarModelosPermitidos(process.env);
  // Solo el motivo: ni la ruta ni el contenido del archivo.
  if (lista.estado === "SIN_LISTA") console.warn(`[ia-local] sin lista de PI de modelos permitidos (${lista.motivo}): la puerta local no se puede configurar`);
  return lista;
}

/** La lista de PI leída al cargar el módulo, con su estado (para la pantalla y el estado de las puertas). */
export const LISTA_MODELOS_PI: ListaModelosPi = cargarAlArrancar();

/** Los modelos aprobados: los de la lista de PI; sin lista, VACÍA. */
export const MODELOS_APROBADOS: readonly ModeloAprobado[] = LISTA_MODELOS_PI.estado === "LISTA" ? LISTA_MODELOS_PI.modelos : Object.freeze([]);

/** La entrada aprobada con ese nombre exacto, o null. */
export function modeloAprobado(nombre: unknown): ModeloAprobado | null {
  return MODELOS_APROBADOS.find((modelo) => modelo.nombre === nombre) ?? null;
}
