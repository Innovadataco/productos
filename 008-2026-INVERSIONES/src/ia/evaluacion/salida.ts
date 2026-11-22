/**
 * La carpeta de resultados del arnés (E7). Con los paquetes del portafolio, lo que se escribe trae cifras reales
 * (los textos renderizados): por eso la carpeta
 * - es absoluta, nunca un enlace, del usuario y 0700 (si ya existe; si no, se crea 0700 con el padre existente);
 * - está fuera de todo repo: ningún ancestro (por realpath) tiene `.git` (carpeta o archivo de un worktree);
 * - no cae en las raíces prohibidas que pase quien llama (con el portafolio, el temporal donde viven los scratchpads).
 * Los archivos se crean 0600 con `wx` (nunca se pisa uno), el JSONL hace fsync por línea (sobrevive a un corte) y las
 * lecturas tienen tope y no siguen enlaces. Ningún error repite la ruta.
 */
import {
  closeSync, constants, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readdirSync, readSync, realpathSync, writeSync, type Stats,
} from "node:fs";
import path from "node:path";

export const CODIGOS_ERROR_SALIDA = Object.freeze([
  "RUTA_RELATIVA", "PADRE_INEXISTENTE", "NO_ES_CARPETA", "ES_ENLACE", "PERMISOS_ABIERTOS", "DE_OTRO_USUARIO", "DENTRO_DE_UN_REPO",
  "EN_CARPETA_PROHIBIDA", "SALIDA_INEXISTENTE", "ARCHIVO_EXISTE", "NOMBRE_INVALIDO", "DEMASIADO_GRANDE", "JSONL_INVALIDO", "NO_SE_PUDO_ESCRIBIR",
  "NO_SE_PUDO_LEER", "ARCHIVO_ABIERTO", "NO_ES_ARCHIVO",
] as const);
export type CodigoErrorSalida = (typeof CODIGOS_ERROR_SALIDA)[number];

export class ErrorSalida extends Error {
  override readonly name = "ErrorSalida";
  constructor(readonly codigo: CodigoErrorSalida) {
    super(`Carpeta de resultados: ${codigo}.`);
  }
}

/** Tope de lectura de un archivo de resultados: 80 corridas con su salida cruda (hasta 64 KiB cada una) caben de sobra. */
export const MAX_BYTES_LECTURA = 32 * 1024 * 1024;
const MODO_CARPETA = 0o700;
const MODO_ARCHIVO = 0o600;
const PERMISOS = 0o777;
const PERMISOS_AJENOS = 0o077;
const NOMBRE = /^[a-z0-9][a-z0-9._-]*$/;

export interface OpcionesCarpeta {
  readonly raicesProhibidas: readonly string[];
  /** Por omisión, true: si no existe, se crea. Con false, que no exista es SALIDA_INEXISTENTE. */
  readonly crear?: boolean;
}

export interface EscritorJsonl {
  anotar(valor: unknown): void;
  cerrar(): void;
}

export interface Carpeta {
  readonly ruta: string;
  crearJsonl(nombre: string): EscritorJsonl;
  escribirArchivo(nombre: string, contenido: string): void;
  leerJsonl(nombre: string, tope?: number): readonly unknown[];
  existe(nombre: string): boolean;
  listar(): readonly string[];
}

const estado = (ruta: string): Stats | null => {
  try {
    return lstatSync(ruta);
  } catch {
    return null;
  }
};

const realOResuelta = (ruta: string): string => (existsSync(ruta) ? realpathSync(ruta) : path.resolve(ruta));

function revisarExistente(st: Stats): void {
  if (st.isSymbolicLink()) throw new ErrorSalida("ES_ENLACE");
  if (!st.isDirectory()) throw new ErrorSalida("NO_ES_CARPETA");
  if ((st.mode & PERMISOS) !== MODO_CARPETA) throw new ErrorSalida("PERMISOS_ABIERTOS");
  if (typeof process.getuid === "function" && st.uid !== process.getuid()) throw new ErrorSalida("DE_OTRO_USUARIO");
}

/** La ruta real donde queda (o quedaría) la carpeta. */
function rutaReal(normal: string, opciones: OpcionesCarpeta): string {
  const st = estado(normal);
  if (st !== null) {
    revisarExistente(st);
    return realpathSync(normal);
  }
  if (opciones.crear === false) throw new ErrorSalida("SALIDA_INEXISTENTE");
  const padre = path.dirname(normal);
  const delPadre = existsSync(padre) ? lstatSync(realpathSync(padre)) : null;
  if (delPadre === null || !delPadre.isDirectory()) throw new ErrorSalida("PADRE_INEXISTENTE");
  return path.join(realpathSync(padre), path.basename(normal));
}

function exigirFueraDeRepos(real: string): void {
  for (let dir = real; ; dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, ".git"))) throw new ErrorSalida("DENTRO_DE_UN_REPO");
    if (path.dirname(dir) === dir) return;
  }
}

function exigirFueraDeLasProhibidas(real: string, raices: readonly string[]): void {
  for (const raiz of raices.map(realOResuelta)) {
    if (real === raiz || real.startsWith(`${raiz}${path.sep}`)) throw new ErrorSalida("EN_CARPETA_PROHIBIDA");
  }
}

/** Revisa la carpeta sin crear nada. Lanza `ErrorSalida`. */
export function revisarCarpeta(ruta: string, opciones: OpcionesCarpeta): void {
  if (!path.isAbsolute(ruta)) throw new ErrorSalida("RUTA_RELATIVA");
  const real = rutaReal(path.resolve(ruta), opciones);
  exigirFueraDeRepos(real);
  exigirFueraDeLasProhibidas(real, opciones.raicesProhibidas);
}

function exigirNombre(nombre: string): void {
  if (!NOMBRE.test(nombre)) throw new ErrorSalida("NOMBRE_INVALIDO");
}

function abrirNuevo(ruta: string): number {
  try {
    return openSync(ruta, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, MODO_ARCHIVO);
  } catch (error) {
    throw new ErrorSalida((error as NodeJS.ErrnoException).code === "EEXIST" ? "ARCHIVO_EXISTE" : "NO_SE_PUDO_ESCRIBIR");
  }
}

function escribirTodo(fd: number, texto: string): void {
  const bytes = Buffer.from(texto, "utf8");
  for (let hecho = 0; hecho < bytes.length;) hecho += writeSync(fd, bytes, hecho, bytes.length - hecho);
  fsyncSync(fd);
}

function leerAcotado(ruta: string, tope: number): string {
  let fd: number;
  try {
    fd = openSync(ruta, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    throw new ErrorSalida("NO_SE_PUDO_LEER");
  }
  try {
    const { size } = fstatSync(fd);
    if (size > tope) throw new ErrorSalida("DEMASIADO_GRANDE");
    const bytes = Buffer.alloc(size);
    for (let leido = 0; leido < size;) {
      const n = readSync(fd, bytes, leido, size - leido, leido);
      if (n === 0) break;
      leido += n;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } finally {
    closeSync(fd);
  }
}

function lineasJson(texto: string): readonly unknown[] {
  try {
    return Object.freeze(texto.split("\n").filter((l) => l.trim() !== "").map((l) => JSON.parse(l) as unknown));
  } catch {
    throw new ErrorSalida("JSONL_INVALIDO");
  }
}

function carpetaEn(ruta: string): Carpeta {
  const en = (nombre: string): string => {
    exigirNombre(nombre);
    return path.join(ruta, nombre);
  };
  return Object.freeze({
    ruta,
    crearJsonl(nombre: string): EscritorJsonl {
      const fd = abrirNuevo(en(nombre));
      let abierto = true;
      return Object.freeze({
        anotar: (valor: unknown): void => escribirTodo(fd, `${JSON.stringify(valor)}\n`),
        cerrar: (): void => {
          if (abierto) closeSync(fd);
          abierto = false;
        },
      });
    },
    escribirArchivo(nombre: string, contenido: string): void {
      const fd = abrirNuevo(en(nombre));
      try {
        escribirTodo(fd, contenido);
      } finally {
        closeSync(fd);
      }
    },
    leerJsonl: (nombre: string, tope: number = MAX_BYTES_LECTURA): readonly unknown[] => lineasJson(leerAcotado(en(nombre), tope)),
    existe: (nombre: string): boolean => existsSync(en(nombre)),
    listar: (): readonly string[] => Object.freeze(readdirSync(ruta).sort()),
  });
}

/** Abre (y si hace falta crea, 0700) la carpeta de resultados ya revisada. Lanza `ErrorSalida`. */
export function abrirCarpeta(ruta: string, opciones: OpcionesCarpeta): Carpeta {
  revisarCarpeta(ruta, opciones);
  const normal = path.resolve(ruta);
  if (estado(normal) === null) {
    try {
      mkdirSync(normal, { mode: MODO_CARPETA });
    } catch {
      throw new ErrorSalida("NO_SE_PUDO_ESCRIBIR");
    }
  }
  return carpetaEn(normal);
}

/**
 * Un archivo con datos del portafolio (el JSON del export): regular, no un enlace, del usuario y sin permisos para el
 * grupo ni para otros (0600 o más cerrado). Lanza `ErrorSalida` sin repetir la ruta.
 */
export function revisarArchivoPrivado(ruta: string): void {
  const st = estado(ruta);
  if (st === null) throw new ErrorSalida("NO_SE_PUDO_LEER");
  if (st.isSymbolicLink()) throw new ErrorSalida("ES_ENLACE");
  if (!st.isFile()) throw new ErrorSalida("NO_ES_ARCHIVO");
  if ((st.mode & PERMISOS_AJENOS) !== 0) throw new ErrorSalida("ARCHIVO_ABIERTO");
  if (typeof process.getuid === "function" && st.uid !== process.getuid()) throw new ErrorSalida("DE_OTRO_USUARIO");
}

/** Un nombre de archivo seguro desde el nombre del modelo: «qwen2.5:14b» → «qwen2.5-14b». */
export function nombreDeModelo(modelo: string): string {
  return modelo.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
}
