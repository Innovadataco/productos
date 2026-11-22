/**
 * Lector zip acotado, propio y mínimo, para los xlsx de las fuentes oficiales. SOLO lo usan los exportadores del Mac:
 * ni la app ni los importadores (candado en tests/unit/lib/lectores-candado.test.ts).
 * - Sin ZIP64, sin cifrado, sin multidisco y sin comentarios (ni en las entradas ni en el registro de fin, que va en
 *   los últimos 22 bytes: no se busca hacia atrás, así no hay dos lecturas posibles del mismo archivo).
 * - Solo los métodos 0 (almacenado) y 8 (deflate); banderas en lista blanca (opciones de deflate, descriptor, UTF-8).
 * - Topes (TOPES_ZIP) de bytes del archivo, entradas, tamaño por entrada, tamaño total y razón de compresión (contra
 *   bombas), todos medidos al abrir sobre lo declarado; al leer, `inflateRawSync` con `maxOutputLength` igual al
 *   tamaño declarado y lo inflado tiene que medir exactamente eso y consumir exactamente lo comprimido.
 * - La cabecera local tiene que coincidir con la central (banderas, método, nombre, CRC y tamaños); el descriptor de
 *   datos (bit 3), si está, también.
 * - Las entradas ocupan el archivo de forma contigua desde el byte 0 hasta el directorio central: sin solapes (bombas
 *   por solape), sin huecos y sin bytes antepuestos.
 * - Nombres ASCII imprimibles sin `\`, `:`, `/` inicial ni segmentos vacíos, `.` o `..`; sin repetidos (tampoco solo
 *   en mayúsculas). Las carpetas (terminan en `/`, tamaño 0) no se listan.
 * - Trabaja sobre su propia copia de la entrada: mutarla después de abrir no cambia lo que se lee.
 * - CRC32 verificado al leer. Cada lectura devuelve una copia propia.
 * - Nunca lanza otra cosa que ErrorZip, con un mensaje fijo por código que no lleva nada de la entrada.
 */
import { inflateRawSync } from "node:zlib";

export type CodigoZip =
  | "ZIP_DEMASIADO_GRANDE"
  | "ZIP_INVALIDO"
  | "ZIP_COMENTARIO_NO_SOPORTADO"
  | "ZIP_MULTIDISCO"
  | "ZIP64_NO_SOPORTADO"
  | "ZIP_CIFRADO"
  | "ZIP_FORMATO_NO_SOPORTADO"
  | "ZIP_METODO_NO_SOPORTADO"
  | "ZIP_DEMASIADAS_ENTRADAS"
  | "ZIP_NOMBRE_INVALIDO"
  | "ZIP_NOMBRE_DUPLICADO"
  | "ZIP_ESTRUCTURA_INVALIDA"
  | "ZIP_CABECERA_DISTINTA"
  | "ZIP_DESCRIPTOR_INVALIDO"
  | "ZIP_ENTRADA_GRANDE"
  | "ZIP_DEMASIADO_CONTENIDO"
  | "ZIP_RAZON_EXCESIVA"
  | "ZIP_INFLADO_EXCESIVO"
  | "ZIP_ENTRADA_INVALIDA"
  | "ZIP_CRC_INVALIDO"
  | "ZIP_ENTRADA_INEXISTENTE"
  | "ZIP_ERROR_INTERNO";

const MENSAJES: Readonly<Record<CodigoZip, string>> = {
  ZIP_DEMASIADO_GRANDE: "El zip pasa del tamaño máximo permitido.",
  ZIP_INVALIDO: "El archivo no es un zip.",
  ZIP_COMENTARIO_NO_SOPORTADO: "El zip trae un comentario al final: no se lee.",
  ZIP_MULTIDISCO: "El zip está partido en varios discos: no se lee.",
  ZIP64_NO_SOPORTADO: "El zip usa ZIP64: no se lee.",
  ZIP_CIFRADO: "El zip está cifrado: no se lee.",
  ZIP_FORMATO_NO_SOPORTADO: "El zip usa una opción que el lector no soporta.",
  ZIP_METODO_NO_SOPORTADO: "El zip usa un método de compresión que el lector no soporta (solo almacenado y deflate).",
  ZIP_DEMASIADAS_ENTRADAS: "El zip tiene más entradas de las permitidas.",
  ZIP_NOMBRE_INVALIDO: "El zip tiene una entrada con un nombre inválido o peligroso.",
  ZIP_NOMBRE_DUPLICADO: "El zip repite el nombre de una entrada.",
  ZIP_ESTRUCTURA_INVALIDA: "La estructura del zip no es válida (directorio, offsets o entradas que se solapan).",
  ZIP_CABECERA_DISTINTA: "La cabecera local de una entrada del zip no coincide con el directorio central.",
  ZIP_DESCRIPTOR_INVALIDO: "El descriptor de datos de una entrada del zip no coincide con el directorio central.",
  ZIP_ENTRADA_GRANDE: "Una entrada del zip pasa del tamaño máximo permitido.",
  ZIP_DEMASIADO_CONTENIDO: "El contenido total del zip pasa del máximo permitido.",
  ZIP_RAZON_EXCESIVA: "Una entrada del zip está comprimida más de lo permitido (posible bomba).",
  ZIP_INFLADO_EXCESIVO: "Una entrada del zip crece más de lo que declara.",
  ZIP_ENTRADA_INVALIDA: "Una entrada del zip tiene datos comprimidos inválidos o no mide lo que declara.",
  ZIP_CRC_INVALIDO: "Una entrada del zip no pasa la verificación de CRC.",
  ZIP_ENTRADA_INEXISTENTE: "El zip no tiene esa entrada.",
  ZIP_ERROR_INTERNO: "El lector de zip falló de una forma no prevista: el archivo no se leyó.",
};

export class ErrorZip extends Error {
  constructor(readonly codigo: CodigoZip) {
    super(MENSAJES[codigo]);
    this.name = "ErrorZip";
  }
}

export interface TopesZip {
  readonly bytesArchivo: number;
  /** Las carpetas cuentan. */
  readonly entradas: number;
  /** Tamaño declarado sin comprimir de cada entrada. */
  readonly bytesPorEntrada: number;
  /** Suma de los tamaños declarados sin comprimir. */
  readonly bytesTotales: number;
  /** Sin comprimir / comprimido, para las entradas de más de `graciaRazon` bytes. */
  readonly razonMaxima: number;
  readonly graciaRazon: number;
  /** En bytes. */
  readonly largoNombre: number;
}

const KiB = 1024;
const MiB = 1024 * KiB;
export const TOPES_ZIP: TopesZip = Object.freeze({ bytesArchivo: 8 * MiB, entradas: 256, bytesPorEntrada: 16 * MiB, bytesTotales: 48 * MiB, razonMaxima: 100, graciaRazon: 64 * KiB, largoNombre: 256 });

export interface ArchivoZip {
  /** Las entradas legibles (sin carpetas), en el orden del directorio central. */
  readonly nombres: readonly string[];
  /** Los bytes sin comprimir de la entrada, verificados con su CRC; una copia propia en cada llamada. */
  leer(nombre: string): Uint8Array;
}

const FIRMA_LOCAL = 0x04034b50;
const FIRMA_CENTRAL = 0x02014b50;
const FIRMA_FIN = 0x06054b50;
const FIRMA_DESCRIPTOR = 0x08074b50;
const FIRMA_LOCALIZADOR_ZIP64 = 0x07064b50;
const LARGO_FIN = 22;
const LARGO_CENTRAL = 46;
const LARGO_LOCAL = 30;
const LARGO_LOCALIZADOR_ZIP64 = 20;
const MAX_COMENTARIO = 0xffff;
const MAX_U16 = 0xffff;
const MAX_U32 = 0xffffffff;
const BANDERAS_CIFRADO = 0x0001 | 0x0040 | 0x2000;
const BANDERA_DESCRIPTOR = 0x0008;
const BANDERAS_PERMITIDAS = 0x0002 | 0x0004 | BANDERA_DESCRIPTOR | 0x0800;
const EXTRA_ZIP64 = 0x0001;
const EXTRA_AES = 0x9901;
const METODO_ALMACENADO = 0;
const METODO_DEFLATE = 8;
const METODO_AES = 99;
const BARRA = 0x2f;
const BARRA_INVERTIDA = 0x5c;
const DOS_PUNTOS = 0x3a;

const TABLA_CRC = Uint32Array.from({ length: 256 }, (_v, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** CRC-32 de zip (polinomio 0xEDB88320). Propio: `zlib.crc32` no existe en todo Node 22. */
export function crc32Zip(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i += 1) c = TABLA_CRC[(c ^ datos[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const error = (codigo: CodigoZip): ErrorZip => new ErrorZip(codigo);

/** Lectura little-endian con límites: salirse del archivo es ZIP_ESTRUCTURA_INVALIDA, nunca un RangeError. */
class Lectura {
  private readonly vista: DataView;
  constructor(readonly bytes: Uint8Array) {
    this.vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  get largo(): number {
    return this.bytes.length;
  }
  private dentro(p: number, largo: number): void {
    if (p < 0 || p + largo > this.bytes.length) throw error("ZIP_ESTRUCTURA_INVALIDA");
  }
  u16(p: number): number {
    this.dentro(p, 2);
    return this.vista.getUint16(p, true);
  }
  u32(p: number): number {
    this.dentro(p, 4);
    return this.vista.getUint32(p, true);
  }
  tramo(p: number, largo: number): Uint8Array {
    this.dentro(p, largo);
    return this.bytes.subarray(p, p + largo);
  }
}

interface Fin {
  readonly entradas: number;
  readonly inicioCentral: number;
  readonly finCentral: number;
}

interface Entrada {
  readonly nombre: string;
  readonly bytesNombre: Uint8Array;
  readonly banderas: number;
  readonly metodo: number;
  readonly crc: number;
  readonly comprimido: number;
  readonly real: number;
  readonly offset: number;
  readonly carpeta: boolean;
}

/** ¿Hay un registro de fin seguido de su comentario? (solo para dar el código exacto del rechazo). */
function tieneComentario(b: Lectura): boolean {
  for (let p = b.largo - LARGO_FIN - 1; p >= Math.max(0, b.largo - LARGO_FIN - MAX_COMENTARIO); p -= 1) {
    if (b.u32(p) === FIRMA_FIN && p + LARGO_FIN + b.u16(p + 20) === b.largo) return true;
  }
  return false;
}

function leerFin(b: Lectura): Fin {
  if (b.largo < LARGO_FIN) throw error("ZIP_INVALIDO");
  const p = b.largo - LARGO_FIN;
  if (b.u32(p) !== FIRMA_FIN) throw error(tieneComentario(b) ? "ZIP_COMENTARIO_NO_SOPORTADO" : "ZIP_INVALIDO");
  if (b.u16(p + 20) !== 0) throw error("ZIP_ESTRUCTURA_INVALIDA");
  if (p >= LARGO_LOCALIZADOR_ZIP64 && b.u32(p - LARGO_LOCALIZADOR_ZIP64) === FIRMA_LOCALIZADOR_ZIP64) throw error("ZIP64_NO_SOPORTADO");
  const [disco, discoCentral, entradasDisco, entradas] = [b.u16(p + 4), b.u16(p + 6), b.u16(p + 8), b.u16(p + 10)];
  const [tamano, inicio] = [b.u32(p + 12), b.u32(p + 16)];
  if ([disco, discoCentral, entradasDisco, entradas].includes(MAX_U16) || tamano === MAX_U32 || inicio === MAX_U32) throw error("ZIP64_NO_SOPORTADO");
  if (disco !== 0 || discoCentral !== 0 || entradasDisco !== entradas) throw error("ZIP_MULTIDISCO");
  if (entradas > TOPES_ZIP.entradas) throw error("ZIP_DEMASIADAS_ENTRADAS");
  if (inicio + tamano !== p) throw error("ZIP_ESTRUCTURA_INVALIDA");
  return { entradas, inicioCentral: inicio, finCentral: p };
}

/** Campos extra: TLV estrictos que caben exactos; ZIP64 y AES se rechazan. */
function revisarExtra(b: Lectura, inicio: number, largo: number): void {
  const fin = inicio + largo;
  for (let q = inicio; q < fin; ) {
    if (q + 4 > fin) throw error("ZIP_ESTRUCTURA_INVALIDA");
    const [id, tam] = [b.u16(q), b.u16(q + 2)];
    if (q + 4 + tam > fin) throw error("ZIP_ESTRUCTURA_INVALIDA");
    if (id === EXTRA_ZIP64) throw error("ZIP64_NO_SOPORTADO");
    if (id === EXTRA_AES) throw error("ZIP_CIFRADO");
    q += 4 + tam;
  }
}

function revisarBanderasYMetodo(banderas: number, metodo: number): void {
  if ((banderas & BANDERAS_CIFRADO) !== 0 || metodo === METODO_AES) throw error("ZIP_CIFRADO");
  if ((banderas & ~BANDERAS_PERMITIDAS) !== 0) throw error("ZIP_FORMATO_NO_SOPORTADO");
  if (metodo !== METODO_ALMACENADO && metodo !== METODO_DEFLATE) throw error("ZIP_METODO_NO_SOPORTADO");
}

function nombreSeguro(bytes: Uint8Array): string {
  if (bytes.length === 0 || bytes.length > TOPES_ZIP.largoNombre) throw error("ZIP_NOMBRE_INVALIDO");
  if (bytes.some((c) => c < 0x20 || c > 0x7e || c === BARRA_INVERTIDA || c === DOS_PUNTOS) || bytes[0] === BARRA) throw error("ZIP_NOMBRE_INVALIDO");
  const nombre = String.fromCharCode(...bytes);
  const segmentos = (nombre.endsWith("/") ? nombre.slice(0, -1) : nombre).split("/");
  if (segmentos.some((s) => s === "" || s === "." || s === "..")) throw error("ZIP_NOMBRE_INVALIDO");
  return nombre;
}

function revisarTamanos(metodo: number, comprimido: number, real: number, carpeta: boolean): void {
  if (carpeta && real !== 0) throw error("ZIP_NOMBRE_INVALIDO");
  if (metodo === METODO_ALMACENADO && comprimido !== real) throw error("ZIP_ENTRADA_INVALIDA");
  if (real > TOPES_ZIP.bytesPorEntrada) throw error("ZIP_ENTRADA_GRANDE");
  if (real > TOPES_ZIP.graciaRazon && real > TOPES_ZIP.razonMaxima * comprimido) throw error("ZIP_RAZON_EXCESIVA");
}

/** Una entrada del directorio central en `p` (que ya se sabe que cabe en el directorio). */
function entradaCentral(b: Lectura, p: number): Entrada {
  const [banderas, metodo, disco, largoNombre, largoExtra] = [b.u16(p + 8), b.u16(p + 10), b.u16(p + 34), b.u16(p + 28), b.u16(p + 30)];
  const [crc, comprimido, real, offset] = [b.u32(p + 16), b.u32(p + 20), b.u32(p + 24), b.u32(p + 42)];
  if (comprimido === MAX_U32 || real === MAX_U32 || offset === MAX_U32 || disco === MAX_U16) throw error("ZIP64_NO_SOPORTADO");
  if (disco !== 0) throw error("ZIP_MULTIDISCO");
  if (b.u16(p + 32) !== 0) throw error("ZIP_COMENTARIO_NO_SOPORTADO");
  revisarExtra(b, p + LARGO_CENTRAL + largoNombre, largoExtra);
  revisarBanderasYMetodo(banderas, metodo);
  const bytesNombre = b.tramo(p + LARGO_CENTRAL, largoNombre);
  const nombre = nombreSeguro(bytesNombre);
  const carpeta = nombre.endsWith("/");
  revisarTamanos(metodo, comprimido, real, carpeta);
  return { nombre, bytesNombre, banderas, metodo, crc, comprimido, real, offset, carpeta };
}

/** Recorre el directorio central entero: tiene que terminar justo en el registro de fin. */
function leerCentral(b: Lectura, fin: Fin): readonly Entrada[] {
  const entradas: Entrada[] = [];
  const vistos = new Set<string>();
  let total = 0;
  let p = fin.inicioCentral;
  for (let k = 0; k < fin.entradas; k += 1) {
    if (p + LARGO_CENTRAL > fin.finCentral || b.u32(p) !== FIRMA_CENTRAL) throw error("ZIP_ESTRUCTURA_INVALIDA");
    const siguiente = p + LARGO_CENTRAL + b.u16(p + 28) + b.u16(p + 30) + b.u16(p + 32);
    if (siguiente > fin.finCentral) throw error("ZIP_ESTRUCTURA_INVALIDA");
    const e = entradaCentral(b, p);
    const clave = e.nombre.toLowerCase();
    if (vistos.has(clave)) throw error("ZIP_NOMBRE_DUPLICADO");
    vistos.add(clave);
    total += e.real;
    if (total > TOPES_ZIP.bytesTotales) throw error("ZIP_DEMASIADO_CONTENIDO");
    entradas.push(e);
    p = siguiente;
  }
  if (p !== fin.finCentral) throw error("ZIP_ESTRUCTURA_INVALIDA");
  return entradas;
}

const iguales = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, k) => v === b[k]);

/** Largo del descriptor de datos en `q` (16 con firma, 12 sin ella); tiene que coincidir con la central. */
function largoDescriptor(b: Lectura, e: Entrada, q: number, limite: number): number {
  const casa = (r: number): boolean => r + 12 <= limite && b.u32(r) === e.crc && b.u32(r + 4) === e.comprimido && b.u32(r + 8) === e.real;
  if (q + 4 <= limite && b.u32(q) === FIRMA_DESCRIPTOR && casa(q + 4)) return 16;
  if (casa(q)) return 12;
  throw error("ZIP_DESCRIPTOR_INVALIDO");
}

/** Cabecera local de `e` (comparada con la central): devuelve dónde empiezan sus datos y dónde termina la entrada. */
function ubicarEntrada(b: Lectura, e: Entrada, limite: number): { readonly inicioDatos: number; readonly fin: number } {
  const p = e.offset;
  if (p + LARGO_LOCAL > limite || b.u32(p) !== FIRMA_LOCAL) throw error("ZIP_ESTRUCTURA_INVALIDA");
  const [banderas, metodo, largoNombre, largoExtra] = [b.u16(p + 6), b.u16(p + 8), b.u16(p + 26), b.u16(p + 28)];
  const [crc, comprimido, real] = [b.u32(p + 14), b.u32(p + 18), b.u32(p + 22)];
  const inicioDatos = p + LARGO_LOCAL + largoNombre + largoExtra;
  if (inicioDatos > limite) throw error("ZIP_ESTRUCTURA_INVALIDA");
  const conDescriptor = (e.banderas & BANDERA_DESCRIPTOR) !== 0;
  const coincide = (local: number, central: number): boolean => local === central || (conDescriptor && local === 0);
  const igualQueCentral = banderas === e.banderas && metodo === e.metodo && iguales(b.tramo(p + LARGO_LOCAL, largoNombre), e.bytesNombre);
  if (!igualQueCentral || !coincide(crc, e.crc) || !coincide(comprimido, e.comprimido) || !coincide(real, e.real)) throw error("ZIP_CABECERA_DISTINTA");
  revisarExtra(b, p + LARGO_LOCAL + largoNombre, largoExtra);
  const finDatos = inicioDatos + e.comprimido;
  if (finDatos > limite) throw error("ZIP_ESTRUCTURA_INVALIDA");
  return { inicioDatos, fin: conDescriptor ? finDatos + largoDescriptor(b, e, finDatos, limite) : finDatos };
}

/** Las entradas, en orden de offset, tienen que ocupar [0, inicio del directorio central) sin solapes ni huecos. */
function ubicar(b: Lectura, entradas: readonly Entrada[], limite: number): ReadonlyMap<Entrada, number> {
  const inicios = new Map<Entrada, number>();
  let esperado = 0;
  for (const e of [...entradas].sort((x, y) => x.offset - y.offset)) {
    if (e.offset !== esperado) throw error("ZIP_ESTRUCTURA_INVALIDA");
    const { inicioDatos, fin } = ubicarEntrada(b, e, limite);
    inicios.set(e, inicioDatos);
    esperado = fin;
  }
  if (esperado !== limite) throw error("ZIP_ESTRUCTURA_INVALIDA");
  return inicios;
}

/** Infla con techo en el tamaño declarado: tiene que dar exactamente eso y consumir exactamente lo comprimido. */
function inflar(datos: Uint8Array, real: number): Uint8Array {
  let resultado: { readonly buffer: Buffer; readonly engine: { readonly bytesWritten: number } };
  try {
    // `info: true` devuelve también el motor, que dice cuántos bytes de entrada consumió (los tipos de Node no lo modelan).
    resultado = inflateRawSync(datos, { maxOutputLength: Math.max(1, real), info: true }) as unknown as typeof resultado;
  } catch (e) {
    throw error((e as { code?: unknown } | null)?.code === "ERR_BUFFER_TOO_LARGE" ? "ZIP_INFLADO_EXCESIVO" : "ZIP_ENTRADA_INVALIDA");
  }
  if (resultado.buffer.length > real) throw error("ZIP_INFLADO_EXCESIVO");
  if (resultado.buffer.length < real || resultado.engine.bytesWritten !== datos.length) throw error("ZIP_ENTRADA_INVALIDA");
  return new Uint8Array(resultado.buffer);
}

function leerEntrada(bytes: Uint8Array, e: (Entrada & { readonly inicioDatos: number }) | undefined): Uint8Array {
  if (!e) throw error("ZIP_ENTRADA_INEXISTENTE");
  const datos = bytes.subarray(e.inicioDatos, e.inicioDatos + e.comprimido);
  const salida = e.metodo === METODO_ALMACENADO ? new Uint8Array(datos) : inflar(datos, e.real);
  if (crc32Zip(salida) !== e.crc) throw error("ZIP_CRC_INVALIDO");
  return salida;
}

/** Cualquier falla que no sea del lector sale como ZIP_ERROR_INTERNO: el mensaje nunca lleva la causa. */
function protegido<T>(trabajo: () => T): T {
  try {
    return trabajo();
  } catch (e) {
    if (e instanceof ErrorZip) throw e;
    throw error("ZIP_ERROR_INTERNO");
  }
}

function abrir(entrada: Uint8Array): ArchivoZip {
  if (entrada.length > TOPES_ZIP.bytesArchivo) throw error("ZIP_DEMASIADO_GRANDE");
  // Copia propia (a lo sumo bytesArchivo): lo validado al abrir es lo que se lee después, aunque el llamador mute la suya.
  const bytes = new Uint8Array(entrada);
  const b = new Lectura(bytes);
  const fin = leerFin(b);
  const entradas = leerCentral(b, fin);
  const inicios = ubicar(b, entradas, fin.inicioCentral);
  const legibles = entradas.filter((e) => !e.carpeta);
  const porNombre = new Map(legibles.map((e) => [e.nombre, { ...e, inicioDatos: inicios.get(e)! }] as const));
  return Object.freeze({
    nombres: Object.freeze(legibles.map((e) => e.nombre)),
    leer: (nombre: string): Uint8Array => protegido(() => leerEntrada(bytes, porNombre.get(nombre))),
  });
}

/**
 * Abre un zip acotado: valida TODA la estructura y los topes antes de devolver nada; las entradas se inflan (y se
 * verifica su CRC) al leerlas. Lanza ErrorZip (y solo ErrorZip).
 */
export function abrirZipAcotado(bytes: Uint8Array): ArchivoZip {
  return protegido(() => abrir(bytes));
}
