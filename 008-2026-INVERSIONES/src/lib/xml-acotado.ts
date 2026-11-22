/**
 * Lector XML acotado, propio y mínimo, para los mensajes SDMX-ML 2.1 de las fuentes oficiales. SOLO lo usan los
 * exportadores del Mac: ni la app ni los importadores (candado en tests/unit/lib/lectores-candado.test.ts).
 * - Sin DTD: rechaza DOCTYPE, ENTITY, CDATA y toda instrucción de procesamiento salvo la declaración `<?xml …?>` del
 *   principio (versión 1.0; encoding, si viene, UTF-8). Así no hay entidades externas ni expansión de entidades.
 * - Solo las cinco entidades predefinidas y las referencias numéricas a caracteres válidos; lo expandido nunca se
 *   vuelve a interpretar.
 * - Solo UTF-8 estricto (la BOM UTF-8 se acepta; UTF-16/32, no) y solo caracteres válidos de XML 1.0.
 * - Topes (TOPES_XML) de bytes, profundidad, atributos por elemento, elementos totales y largo de nombre.
 * - Espacios de nombres resueltos (XML Namespaces 1.0). Nombres solo ASCII.
 * - Devuelve un árbol inmutable (todo congelado); los valores son SIEMPRE texto, nunca número.
 * - No valida esquemas: un XHTML bien formado se lee. Quien consume valida la raíz y su espacio de nombres.
 * - Recorrido iterativo (sin recursión) y lineal en el tamaño de la entrada.
 * - Nunca lanza otra cosa que ErrorXml, con un mensaje fijo por código que no lleva nada de la entrada.
 */

export type CodigoXml =
  | "XML_DEMASIADO_GRANDE"
  | "XML_UTF8_INVALIDO"
  | "XML_CODIFICACION_NO_SOPORTADA"
  | "XML_CARACTER_INVALIDO"
  | "XML_DECLARACION_INVALIDA"
  | "XML_DOCTYPE_PROHIBIDO"
  | "XML_ENTIDAD_PROHIBIDA"
  | "XML_CDATA_PROHIBIDO"
  | "XML_INSTRUCCION_PROHIBIDA"
  | "XML_ENTIDAD_DESCONOCIDA"
  | "XML_REFERENCIA_INVALIDA"
  | "XML_PROFUNDIDAD_EXCESIVA"
  | "XML_DEMASIADOS_ATRIBUTOS"
  | "XML_DEMASIADOS_ELEMENTOS"
  | "XML_ATRIBUTO_DUPLICADO"
  | "XML_PREFIJO_DESCONOCIDO"
  | "XML_ESPACIO_INVALIDO"
  | "XML_NOMBRE_INVALIDO"
  | "XML_ETIQUETA_DESCUADRADA"
  | "XML_INCOMPLETO"
  | "XML_MAL_FORMADO"
  | "XML_SIN_RAIZ"
  | "XML_ERROR_INTERNO";

const MENSAJES: Readonly<Record<CodigoXml, string>> = {
  XML_DEMASIADO_GRANDE: "El XML pasa del tamaño máximo permitido.",
  XML_UTF8_INVALIDO: "El XML no es UTF-8 válido.",
  XML_CODIFICACION_NO_SOPORTADA: "El XML usa una codificación distinta de UTF-8.",
  XML_CARACTER_INVALIDO: "El XML tiene un carácter que XML 1.0 no permite.",
  XML_DECLARACION_INVALIDA: "La declaración <?xml …?> del XML no es válida (solo versión 1.0).",
  XML_DOCTYPE_PROHIBIDO: "El XML trae una DTD (DOCTYPE): no se lee.",
  XML_ENTIDAD_PROHIBIDA: "El XML declara entidades: no se lee.",
  XML_CDATA_PROHIBIDO: "El XML trae una sección CDATA: no se lee.",
  XML_INSTRUCCION_PROHIBIDA: "El XML trae una instrucción de procesamiento: no se lee.",
  XML_ENTIDAD_DESCONOCIDA: "El XML usa una entidad que no es de las predefinidas.",
  XML_REFERENCIA_INVALIDA: "El XML tiene una referencia numérica a un carácter inválido.",
  XML_PROFUNDIDAD_EXCESIVA: "El XML anida elementos más hondo de lo permitido.",
  XML_DEMASIADOS_ATRIBUTOS: "Un elemento del XML tiene más atributos de los permitidos.",
  XML_DEMASIADOS_ELEMENTOS: "El XML tiene más elementos de los permitidos.",
  XML_ATRIBUTO_DUPLICADO: "Un elemento del XML repite un atributo.",
  XML_PREFIJO_DESCONOCIDO: "El XML usa un prefijo de espacio de nombres sin declarar.",
  XML_ESPACIO_INVALIDO: "El XML declara un espacio de nombres inválido.",
  XML_NOMBRE_INVALIDO: "El XML tiene un nombre de elemento o de atributo inválido o demasiado largo.",
  XML_ETIQUETA_DESCUADRADA: "Una etiqueta de cierre del XML no corresponde a la que está abierta.",
  XML_INCOMPLETO: "El XML termina antes de tiempo.",
  XML_MAL_FORMADO: "El XML está mal formado.",
  XML_SIN_RAIZ: "El XML no tiene elemento raíz.",
  XML_ERROR_INTERNO: "El lector de XML falló de una forma no prevista: el archivo no se leyó.",
};

export class ErrorXml extends Error {
  constructor(readonly codigo: CodigoXml) {
    super(MENSAJES[codigo]);
    this.name = "ErrorXml";
  }
}

export interface AtributoXml {
  /** Nombre calificado, tal cual (`prefijo:local` o `local`). */
  readonly nombre: string;
  readonly local: string;
  /** URI del espacio de nombres; null si el atributo no lleva prefijo. */
  readonly espacio: string | null;
  readonly valor: string;
}

export interface ElementoXml {
  readonly nombre: string;
  readonly local: string;
  readonly espacio: string | null;
  /** Sin las declaraciones `xmlns` (que sí cuentan para el tope). */
  readonly atributos: readonly AtributoXml[];
  readonly hijos: readonly ElementoXml[];
  /** El texto directo del elemento (sin el de los hijos ni los comentarios), sin recortar. */
  readonly texto: string;
}

export interface TopesXml {
  readonly bytes: number;
  /** La raíz es el nivel 1. */
  readonly profundidad: number;
  readonly atributosPorElemento: number;
  /** La raíz cuenta. */
  readonly elementos: number;
  readonly largoNombre: number;
}

export const TOPES_XML: TopesXml = Object.freeze({ bytes: 4 * 1024 * 1024, profundidad: 32, atributosPorElemento: 64, elementos: 200_000, largoNombre: 256 });

const NS_XML = "http://www.w3.org/XML/1998/namespace";
const NS_XMLNS = "http://www.w3.org/2000/xmlns/";
/** Caracteres entre `&` y `;` (`#x10FFFF` son 8): más largo, mal formado. */
const MAX_REFERENCIA = 32;
const MAX_DECLARACION = 256;

const CARACTER_INVALIDO = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/;
const NOMBRE = /[A-Za-z_][A-Za-z0-9._-]*(?::[A-Za-z_][A-Za-z0-9._-]*)?/y;
const NOMBRE_ENTIDAD = /^[A-Za-z_][A-Za-z0-9._-]*$/;
const SOLO_ESPACIOS = /^[ \t\n]*$/;
const DTD = /^<!(?:DOCTYPE|ELEMENT|ATTLIST|NOTATION)/i;
const DECLARACION =
  /^<\?xml[ \t\n]+version[ \t\n]*=[ \t\n]*(["'])1\.0\1(?:[ \t\n]+encoding[ \t\n]*=[ \t\n]*(["'])([A-Za-z][A-Za-z0-9._-]*)\2)?(?:[ \t\n]+standalone[ \t\n]*=[ \t\n]*(["'])(?:yes|no)\4)?[ \t\n]*\?>$/;
const PREDEFINIDAS: ReadonlyMap<string, string> = new Map([
  ["lt", "<"],
  ["gt", ">"],
  ["amp", "&"],
  ["apos", "'"],
  ["quot", '"'],
]);

const esEspacio = (c: string | undefined): boolean => c === " " || c === "\t" || c === "\n";
const esCaracterXml = (c: number): boolean =>
  c === 0x9 || c === 0xa || c === 0xd || (c >= 0x20 && c <= 0xd7ff) || (c >= 0xe000 && c <= 0xfffd) || (c >= 0x10000 && c <= 0x10ffff);

/** Tope de bytes, BOM, UTF-8 estricto, caracteres de XML 1.0 y fin de línea normalizado a LF. */
function decodificar(bytes: Uint8Array): string {
  if (bytes.length > TOPES_XML.bytes) throw new ErrorXml("XML_DEMASIADO_GRANDE");
  const [b0, b1, b2, b3] = [bytes[0], bytes[1], bytes[2], bytes[3]];
  const utf16 = (b0 === 0xfe && b1 === 0xff) || (b0 === 0xff && b1 === 0xfe);
  if (utf16 || (b0 === 0 && b1 === 0 && b2 === 0xfe && b3 === 0xff)) throw new ErrorXml("XML_CODIFICACION_NO_SOPORTADA");
  const inicio = b0 === 0xef && b1 === 0xbb && b2 === 0xbf ? 3 : 0;
  let texto: string;
  try {
    texto = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(inicio));
  } catch {
    throw new ErrorXml("XML_UTF8_INVALIDO");
  }
  if (CARACTER_INVALIDO.test(texto)) throw new ErrorXml("XML_CARACTER_INVALIDO");
  return texto.replace(/\r\n?/g, "\n");
}

function caracterNumerico(cuerpo: string): string {
  const hex = cuerpo.startsWith("#x");
  const digitos = cuerpo.slice(hex ? 2 : 1);
  if (!(hex ? /^[0-9A-Fa-f]+$/ : /^[0-9]+$/).test(digitos)) throw new ErrorXml("XML_REFERENCIA_INVALIDA");
  const valor = Number.parseInt(digitos, hex ? 16 : 10);
  if (!esCaracterXml(valor)) throw new ErrorXml("XML_REFERENCIA_INVALIDA");
  return String.fromCodePoint(valor);
}

function referencia(cuerpo: string): string {
  if (cuerpo.startsWith("#")) return caracterNumerico(cuerpo);
  const predefinida = PREDEFINIDAS.get(cuerpo);
  if (predefinida !== undefined) return predefinida;
  throw new ErrorXml(NOMBRE_ENTIDAD.test(cuerpo) ? "XML_ENTIDAD_DESCONOCIDA" : "XML_MAL_FORMADO");
}

/** Expande las referencias de un texto o del valor de un atributo (en el atributo, tab y LF literales pasan a espacio). */
function expandir(crudo: string, enAtributo: boolean): string {
  const normalizar = (t: string): string => (enAtributo ? t.replace(/[\t\n]/g, " ") : t);
  let amp = crudo.indexOf("&");
  if (amp === -1) return normalizar(crudo);
  const partes: string[] = [];
  let desde = 0;
  while (amp !== -1) {
    partes.push(normalizar(crudo.slice(desde, amp)));
    const fin = crudo.slice(amp + 1, amp + 2 + MAX_REFERENCIA).indexOf(";");
    if (fin === -1) throw new ErrorXml("XML_MAL_FORMADO");
    partes.push(referencia(crudo.slice(amp + 1, amp + 1 + fin)));
    desde = amp + 2 + fin;
    amp = crudo.indexOf("&", desde);
  }
  partes.push(normalizar(crudo.slice(desde)));
  return partes.join("");
}

/** Ámbito de espacios de nombres en cadena (sin copiar mapas): `null` es el espacio por defecto desligado. */
interface Ambito {
  readonly padre: Ambito | null;
  readonly propios: ReadonlyMap<string, string | null>;
}
const AMBITO_RAIZ: Ambito = { padre: null, propios: new Map([["xml", NS_XML]]) };

function buscarEspacio(ambito: Ambito, prefijo: string): string | null | undefined {
  for (let a: Ambito | null = ambito; a; a = a.padre) {
    const uri = a.propios.get(prefijo);
    if (uri !== undefined) return uri;
  }
  return undefined;
}

type Crudo = readonly [nombre: string, valor: string];

const prefijoDeclarado = (nombre: string): string | null => (nombre === "xmlns" ? "" : nombre.startsWith("xmlns:") ? nombre.slice(6) : null);

function validarDeclaracion(prefijo: string, uri: string): void {
  const invalida =
    prefijo === "xmlns" || (prefijo === "xml" ? uri !== NS_XML : uri === NS_XML || uri === NS_XMLNS || (prefijo !== "" && uri === ""));
  if (invalida) throw new ErrorXml("XML_ESPACIO_INVALIDO");
}

function ambitoDe(padre: Ambito, crudos: readonly Crudo[]): Ambito {
  const propios = new Map<string, string | null>();
  for (const [nombre, uri] of crudos) {
    const prefijo = prefijoDeclarado(nombre);
    if (prefijo === null) continue;
    validarDeclaracion(prefijo, uri);
    propios.set(prefijo, prefijo === "" && uri === "" ? null : uri);
  }
  return propios.size === 0 ? padre : { padre, propios };
}

function resolver(nombre: string, ambito: Ambito, esElemento: boolean): { readonly local: string; readonly espacio: string | null } {
  const dos = nombre.indexOf(":");
  if (dos === -1) return { local: nombre, espacio: esElemento ? (buscarEspacio(ambito, "") ?? null) : null };
  // Un prefijo nunca queda ligado a null (`xmlns:p=""` se rechaza): solo puede faltar.
  const uri = buscarEspacio(ambito, nombre.slice(0, dos));
  if (typeof uri !== "string") throw new ErrorXml("XML_PREFIJO_DESCONOCIDO");
  return { local: nombre.slice(dos + 1), espacio: uri };
}

function atributosDe(crudos: readonly Crudo[], ambito: Ambito): readonly AtributoXml[] {
  const expandidos = new Set<string>();
  const atributos: AtributoXml[] = [];
  for (const [nombre, valor] of crudos) {
    if (prefijoDeclarado(nombre) !== null) continue;
    const { local, espacio } = resolver(nombre, ambito, false);
    const clave = `${espacio ?? ""}\u0000${local}`;
    if (expandidos.has(clave)) throw new ErrorXml("XML_ATRIBUTO_DUPLICADO");
    expandidos.add(clave);
    atributos.push(Object.freeze({ nombre, local, espacio, valor }));
  }
  return Object.freeze(atributos);
}

/** Elemento abierto mientras se lee (estado interno del lector; lo que sale es inmutable). */
interface Abierto {
  readonly nombre: string;
  readonly local: string;
  readonly espacio: string | null;
  readonly atributos: readonly AtributoXml[];
  readonly ambito: Ambito;
  readonly hijos: ElementoXml[];
  readonly textos: string[];
}

class Analizador {
  private i = 0;
  private elementos = 0;
  private raiz: ElementoXml | null = null;
  private readonly pila: Abierto[] = [];

  constructor(private readonly s: string) {}

  documento(): ElementoXml {
    this.declaracion();
    while (this.i < this.s.length) {
      const j = this.s.indexOf("<", this.i);
      const fin = j === -1 ? this.s.length : j;
      if (fin > this.i) this.texto(this.s.slice(this.i, fin));
      if (j === -1) break;
      this.i = j;
      this.marca();
    }
    if (this.pila.length > 0) throw new ErrorXml("XML_INCOMPLETO");
    if (this.raiz === null) throw new ErrorXml("XML_SIN_RAIZ");
    return this.raiz;
  }

  private declaracion(): void {
    if (!this.s.startsWith("<?xml") || !(esEspacio(this.s[5]) || this.s[5] === "?")) return;
    const fin = this.s.slice(0, MAX_DECLARACION).indexOf("?>");
    const m = fin === -1 ? null : DECLARACION.exec(this.s.slice(0, fin + 2));
    if (!m) throw new ErrorXml("XML_DECLARACION_INVALIDA");
    if (m[3] !== undefined && m[3].toLowerCase() !== "utf-8") throw new ErrorXml("XML_CODIFICACION_NO_SOPORTADA");
    this.i = fin + 2;
  }

  private texto(crudo: string): void {
    const actual = this.pila[this.pila.length - 1];
    if (!actual) {
      if (!SOLO_ESPACIOS.test(crudo)) throw new ErrorXml("XML_MAL_FORMADO");
      return;
    }
    if (crudo.includes("]]>")) throw new ErrorXml("XML_MAL_FORMADO");
    actual.textos.push(expandir(crudo, false));
  }

  private marca(): void {
    const siguiente = this.s[this.i + 1];
    if (siguiente === "!") return this.especial();
    if (siguiente === "?") throw new ErrorXml("XML_INSTRUCCION_PROHIBIDA");
    if (siguiente === "/") return this.cierre();
    return this.apertura();
  }

  /** `<!…`: solo comentarios; lo demás (DTD, entidades, CDATA) se rechaza. */
  private especial(): void {
    const s = this.s;
    if (s.startsWith("<!--", this.i)) {
      const fin = s.indexOf("-->", this.i + 4);
      if (fin === -1) throw new ErrorXml("XML_INCOMPLETO");
      const cuerpo = s.slice(this.i + 4, fin);
      if (cuerpo.includes("--") || cuerpo.endsWith("-")) throw new ErrorXml("XML_MAL_FORMADO");
      this.i = fin + 3;
      return;
    }
    if (s.startsWith("<![CDATA[", this.i)) throw new ErrorXml("XML_CDATA_PROHIBIDO");
    if (s.startsWith("<!ENTITY", this.i)) throw new ErrorXml("XML_ENTIDAD_PROHIBIDA");
    if (DTD.test(s.slice(this.i, this.i + 10))) throw new ErrorXml("XML_DOCTYPE_PROHIBIDO");
    throw new ErrorXml("XML_MAL_FORMADO");
  }

  private saltarEspacios(): void {
    while (esEspacio(this.s[this.i])) this.i += 1;
  }

  /** Lee un nombre en `pos`: ASCII, a lo sumo un prefijo, seguido de un delimitador, y dentro del tope de largo. */
  private nombre(pos: number): string {
    NOMBRE.lastIndex = pos;
    const m = NOMBRE.exec(this.s);
    if (!m) throw new ErrorXml(pos >= this.s.length ? "XML_INCOMPLETO" : "XML_NOMBRE_INVALIDO");
    const sig = this.s[pos + m[0].length];
    const delimitado = sig === undefined || esEspacio(sig) || sig === "/" || sig === ">" || sig === "=";
    if (!delimitado || m[0].length > TOPES_XML.largoNombre) throw new ErrorXml("XML_NOMBRE_INVALIDO");
    this.i = pos + m[0].length;
    return m[0];
  }

  private cierre(): void {
    if (esEspacio(this.s[this.i + 2])) throw new ErrorXml("XML_MAL_FORMADO");
    const nombre = this.nombre(this.i + 2);
    this.saltarEspacios();
    if (this.i >= this.s.length) throw new ErrorXml("XML_INCOMPLETO");
    if (this.s[this.i] !== ">") throw new ErrorXml("XML_MAL_FORMADO");
    this.i += 1;
    const actual = this.pila.pop();
    if (!actual) throw new ErrorXml("XML_MAL_FORMADO");
    if (actual.nombre !== nombre) throw new ErrorXml("XML_ETIQUETA_DESCUADRADA");
    this.cerrar(actual);
  }

  private apertura(): void {
    const pos = this.i + 1;
    if (pos >= this.s.length) throw new ErrorXml("XML_INCOMPLETO");
    if (esEspacio(this.s[pos]) || this.raiz !== null) throw new ErrorXml("XML_MAL_FORMADO");
    const nombre = this.nombre(pos);
    this.elementos += 1;
    if (this.elementos > TOPES_XML.elementos) throw new ErrorXml("XML_DEMASIADOS_ELEMENTOS");
    if (this.pila.length + 1 > TOPES_XML.profundidad) throw new ErrorXml("XML_PROFUNDIDAD_EXCESIVA");
    const { crudos, vacio } = this.atributos();
    const ambito = ambitoDe(this.pila[this.pila.length - 1]?.ambito ?? AMBITO_RAIZ, crudos);
    const { local, espacio } = resolver(nombre, ambito, true);
    const abierto: Abierto = { nombre, local, espacio, atributos: atributosDe(crudos, ambito), ambito, hijos: [], textos: [] };
    if (vacio) this.cerrar(abierto);
    else this.pila.push(abierto);
  }

  /** Atributos de una etiqueta de apertura, hasta `>` o `/>`. */
  private atributos(): { readonly crudos: readonly Crudo[]; readonly vacio: boolean } {
    const s = this.s;
    const crudos: Crudo[] = [];
    const vistos = new Set<string>();
    for (;;) {
      const antes = this.i;
      this.saltarEspacios();
      if (this.i >= s.length) throw new ErrorXml("XML_INCOMPLETO");
      if (s[this.i] === ">" || s.startsWith("/>", this.i)) {
        const vacio = s[this.i] === "/";
        this.i += vacio ? 2 : 1;
        return { crudos, vacio };
      }
      if (s[this.i] === "/") throw new ErrorXml(this.i + 1 >= s.length ? "XML_INCOMPLETO" : "XML_MAL_FORMADO");
      if (this.i === antes) throw new ErrorXml("XML_MAL_FORMADO");
      const nombre = this.nombre(this.i);
      const valor = this.valor();
      if (vistos.has(nombre)) throw new ErrorXml("XML_ATRIBUTO_DUPLICADO");
      vistos.add(nombre);
      if (crudos.length + 1 > TOPES_XML.atributosPorElemento) throw new ErrorXml("XML_DEMASIADOS_ATRIBUTOS");
      crudos.push([nombre, valor]);
    }
  }

  /** `= "valor"` (o con comillas simples), ya expandido. */
  private valor(): string {
    const s = this.s;
    this.saltarEspacios();
    const igual = s[this.i];
    this.i += 1;
    this.saltarEspacios();
    const comilla = s[this.i];
    if (this.i >= s.length) throw new ErrorXml("XML_INCOMPLETO");
    if (igual !== "=" || (comilla !== '"' && comilla !== "'")) throw new ErrorXml("XML_MAL_FORMADO");
    const cierre = s.indexOf(comilla, this.i + 1);
    if (cierre === -1) throw new ErrorXml("XML_INCOMPLETO");
    const crudo = s.slice(this.i + 1, cierre);
    if (crudo.includes("<")) throw new ErrorXml("XML_MAL_FORMADO");
    this.i = cierre + 1;
    return expandir(crudo, true);
  }

  private cerrar(a: Abierto): void {
    const elemento: ElementoXml = Object.freeze({ nombre: a.nombre, local: a.local, espacio: a.espacio, atributos: a.atributos, hijos: Object.freeze(a.hijos), texto: a.textos.join("") });
    const padre = this.pila[this.pila.length - 1];
    if (padre) padre.hijos.push(elemento);
    else this.raiz = elemento;
  }
}

/**
 * Lee un XML acotado y devuelve su elemento raíz (inmutable). Lanza ErrorXml (y solo ErrorXml): cualquier otra
 * falla sale como XML_ERROR_INTERNO, sin la causa.
 */
export function leerXmlAcotado(bytes: Uint8Array): ElementoXml {
  try {
    return new Analizador(decodificar(bytes)).documento();
  } catch (e) {
    if (e instanceof ErrorXml) throw e;
    throw new ErrorXml("XML_ERROR_INTERNO");
  }
}

/** Valor del atributo `local` (sin prefijo, o del espacio `espacio`), o undefined. */
export function buscarAtributo(elemento: ElementoXml, local: string, espacio: string | null = null): string | undefined {
  return elemento.atributos.find((a) => a.local === local && a.espacio === espacio)?.valor;
}
