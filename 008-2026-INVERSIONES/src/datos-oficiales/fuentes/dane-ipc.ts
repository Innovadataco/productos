/**
 * El anexo de índices del IPC del DANE (`anex-IPC-Indices`, xlsx) → la serie IPC_INDICE del catálogo, en el CSV canónico
 * de series (fase C, C2d). SOLO lo usa el exportador del Mac, scripts/exportar-ipc.ts: el zip y el XML se leen con los
 * lectores acotados (src/lib/zip-acotado.ts y xml-acotado.ts), que ni la app ni los importadores alcanzan
 * (tests/unit/lib/lectores-candado.test.ts). Puro: ni red, ni base, ni sistema de archivos.
 * - Solo con el archivo: la ruta del anexo en el DANE cambia cada mes; el dueño lo baja y lo pasa con --archivo.
 * - Solo el índice (P9, decisión de la Fábrica): la variación la calcula 008 después (C5a) y no se importa.
 *
 * La forma que se exige (verificada el 2026-11-21 en una descarga pública; si el DANE la cambia, falla cerrado con
 * DANE_FORMATO y su detalle, antes que adivinar):
 * - Libro transitional (no strict) de UNA hoja en xl/workbook.xml; la hoja y los textos compartidos, por sus
 *   relaciones internas de xl/_rels/workbook.xml.rels (dentro de xl/worksheets/ y de xl/).
 * - Una sola celda «Mes»; a su derecha, en su fila, los años (números enteros 19AA o 20AA, consecutivos, a lo sumo
 *   MAX_ANIOS_ANEXO); debajo, los 12 meses de Enero a Diciembre, en orden; en el cruce, el índice del mes como número
 *   escrito (sin fórmula). Los meses no publicados del último año van vacíos (ausentes o con solo estilo). En esas 13
 *   filas, nada con valor a la derecha del último año.
 * - La hoja dice «Total, Índice de Precios al Consumidor (IPC)», «Número Índice» y «Base Diciembre de 2018 = 100,00»:
 *   otro anexo del DANE (variaciones, divisiones, ciudades) u otra base no pasan. Las etiquetas y los meses se comparan
 *   normalizados (NFC, espacios colapsados, minúsculas).
 * - Estricto solo en lo que se lee: fuera de la tabla, una celda solo necesita una referencia válida (de su fila, sin
 *   repetir, con las filas en orden ascendente), un tipo de OOXML y, si es t="s", un texto compartido que exista.
 * Los valores: texto decimal (hasta 6 enteros y 20 decimales) redondeado a la escala del catálogo con tolerancia de
 * 1e-9, en BigInt y nunca con Number (65.510000000000005 es un artefacto del float del xlsx; 65.515 no lo es y se
 * rechaza); después, el rango de cordura del catálogo.
 * El periodo: un mes que no ha terminado (hasta ≥ hoy en Bogotá) no entra, y rechaza el anexo entero (MES_ABIERTO): un
 * anexo verdadero nunca lo trae; si lo trae, es otro archivo o un reloj mal puesto.
 * Precedencia fija: contenedor → libro y relaciones → textos → celdas → etiquetas (MES, TITULO, base) → años → meses →
 * fuera de la tabla → cada valor en orden cronológico (celda, valor, rango) → DANE_HUECO → SIN_VALORES → MES_ABIERTO.
 * Nunca lanza: lo que no viene de los lectores ni de la forma sale ERROR_INTERNO (un error propio no se esconde como un
 * cambio del DANE). Los mensajes son fijos; lo único del archivo que se repite es la celda, ya validada (letras y
 * dígitos), nunca un valor.
 */
import { CATALOGO, serieDelCatalogo, type SerieCatalogo } from "../catalogo";
import { leerArgumentosImportarSeries, type ArgumentosImportarSeries } from "../series/argumentos";
import { canonizarValor, compararDecimales, escribirCsvSeries, type ValorSerie } from "../series/csv-series";
import type { ResultadoArchivo } from "../../lib/archivo-acotado";
import { ErrorXml, buscarAtributo, leerXmlAcotado, type CodigoXml, type ElementoXml } from "../../lib/xml-acotado";
import { ErrorZip, abrirZipAcotado, type ArchivoZip, type CodigoZip } from "../../lib/zip-acotado";
import { ErrorArgumentosCarga } from "../../cli/opciones";
import { diaIso } from "../../precios/horario";

export const SERIE_IPC = "IPC_INDICE";
/** El anexo real pesa unas decenas de KB (40 KB el de octubre de 2026): 2 MiB es margen de sobra. */
export const MAX_BYTES_ANEXO_IPC = 2 * 1024 * 1024;
/** La serie de empalme trae 24 años (2003–2026): 100 es margen de sobra y cabe en el CSV (1 200 filas). */
export const MAX_ANIOS_ANEXO = 100;
/** Decimales máximos del texto del anexo (Excel escribe a lo sumo 17 cifras significativas). */
const DECIMALES_MAX = 20;
/** Tolerancia del redondeo: 1e-9. */
const EXPONENTE_TOLERANCIA = 9;

/** Etiquetas y meses del anexo, copiados de la descarga pública del 2026-11-21. */
const ETIQUETAS_ANEXO_IPC = Object.freeze({
  mes: "Mes",
  titulo: "Total, Índice de Precios al Consumidor (IPC)",
  numero: "Número Índice",
  base: "Base Diciembre de 2018 = 100,00",
});
const MESES_ANEXO_IPC: readonly string[] = Object.freeze([
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]);

const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_STRICT = "http://purl.oclc.org/ooxml/spreadsheetml/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_RELACIONES = "http://schemas.openxmlformats.org/package/2006/relationships";
const TIPO_HOJA = `${NS_R}/worksheet`;
const TIPO_TEXTOS = `${NS_R}/sharedStrings`;
const PARTE_LIBRO = "xl/workbook.xml";
const PARTE_RELACIONES = "xl/_rels/workbook.xml.rels";
const CARPETA_LIBRO = "xl/";
const DESTINO_HOJA = /^xl\/worksheets\/[A-Za-z0-9_-]{1,64}\.xml$/;
const DESTINO_TEXTOS = /^xl\/[A-Za-z0-9_-]{1,64}\.xml$/;
const REFERENCIA = /^([A-Z]{1,3})([1-9][0-9]{0,6})$/;
const NUMERO_FILA = /^[1-9][0-9]{0,6}$/;
const INDICE_TEXTO = /^(0|[1-9][0-9]{0,8})$/;
const ANIO = /^(19|20)[0-9]{2}$/;
const VALOR_ANEXO = /^([0-9]{1,6})(?:\.([0-9]{1,20}))?$/;
const TIPOS_OOXML: ReadonlySet<string> = new Set(["b", "d", "e", "inlineStr", "n", "s", "str"]);
const FILAS_TABLA = 13;

export type CodigoAnexoIpc =
  | "ANEXO_ZIP" | "ANEXO_XML" | "DANE_FORMATO" | "DANE_BASE_DISTINTA" | "DANE_ANIOS" | "DANE_MES_DESCONOCIDO" | "DANE_CELDA"
  | "DANE_VALOR" | "VALOR_FUERA_DE_RANGO" | "DANE_HUECO" | "SIN_VALORES" | "MES_ABIERTO" | "ERROR_INTERNO";
/** El detalle de DANE_FORMATO: qué parte de la forma no se cumple. */
export type DetalleFormatoIpc =
  | "PARTES" | "RAIZ" | "STRICT" | "HOJAS" | "REL" | "SST" | "REF" | "TIPO" | "MES" | "TITULO" | "TOPE_ANIOS" | "FUERA_DE_TABLA";

export interface FalloAnexoIpc {
  readonly ok: false;
  readonly codigo: CodigoAnexoIpc;
  /** El código del lector (ANEXO_ZIP, ANEXO_XML) o la parte de la forma (DANE_FORMATO). */
  readonly detalle?: CodigoZip | CodigoXml | DetalleFormatoIpc;
  /** La referencia de la celda (A1…), si el fallo está en una. */
  readonly celda?: string;
}

export type LecturaAnexoIpc = { readonly ok: true; readonly valores: readonly ValorSerie[] } | FalloAnexoIpc;

const MENSAJES: Readonly<Record<CodigoAnexoIpc, string>> = {
  ANEXO_ZIP: "el archivo no es un xlsx que el lector acotado acepte (¿es el anexo anex-IPC-Indices en .xlsx?).",
  ANEXO_XML: "una parte del xlsx no es un XML que el lector acotado acepte.",
  DANE_FORMATO: "el anexo no tiene la forma esperada (libro de una hoja con la tabla «Mes» × años): no se adivina; avise al CEO de 008.",
  DANE_BASE_DISTINTA: "el anexo no dice «Base Diciembre de 2018 = 100,00»: si el DANE cambió la base, el catálogo tiene que cambiar antes.",
  DANE_ANIOS: "a la derecha de «Mes» no hay una lista de años (19AA o 20AA) consecutivos, escritos como números.",
  DANE_MES_DESCONOCIDO: "debajo de «Mes» no están los 12 meses, de Enero a Diciembre, en orden.",
  DANE_CELDA: "una celda de la tabla no es un número escrito (es una fórmula, un texto, otro tipo o está vacía).",
  DANE_VALOR: "un valor no es un decimal con los decimales del catálogo (más allá del redondeo del xlsx, de 1e-9).",
  VALOR_FUERA_DE_RANGO: "un valor está fuera del rango de cordura del catálogo.",
  DANE_HUECO: "falta un mes antes del último publicado.",
  SIN_VALORES: "la tabla no trae ningún valor.",
  MES_ABIERTO: "trae un mes que todavía no ha terminado: el IPC de un mes abierto no entra.",
  ERROR_INTERNO: "el lector del anexo falló de una forma no prevista.",
};

function armarFallo(codigo: CodigoAnexoIpc, detalle?: FalloAnexoIpc["detalle"], celda?: string): FalloAnexoIpc {
  return Object.freeze({ ok: false, codigo, ...(detalle === undefined ? {} : { detalle }), ...(celda === undefined ? {} : { celda }) });
}

/** El fallo de la forma o del contenido: se lanza dentro y se devuelve en leerAnexoIpc. */
class FalloIpc extends Error {
  constructor(readonly fallo: FalloAnexoIpc) {
    super(fallo.codigo);
    this.name = "FalloIpc";
  }
}

function formato(detalle: DetalleFormatoIpc, celda?: string): never {
  throw new FalloIpc(armarFallo("DANE_FORMATO", detalle, celda));
}

function rechazo(codigo: CodigoAnexoIpc, celda?: string): never {
  throw new FalloIpc(armarFallo(codigo, undefined, celda));
}

/**
 * El texto decimal del xlsx redondeado a `escala` decimales (mitad hacia arriba), en canónico, si difiere de lo escrito
 * en 1e-9 o menos (el artefacto del float); null si no es un decimal sin signo ni exponente de hasta 6 enteros y 20
 * decimales, o si difiere más. Aritmética entera (BigInt), nunca Number.
 */
export function redondearIndice(texto: string, escala: number): string | null {
  const m = VALOR_ANEXO.exec(texto);
  if (!m) return null;
  const crudo = BigInt(`${m[1]}${(m[2] ?? "").padEnd(DECIMALES_MAX, "0")}`);
  const unidad = 10n ** BigInt(DECIMALES_MAX - escala);
  const redondeado = (crudo + unidad / 2n) / unidad;
  const diferencia = crudo - redondeado * unidad;
  const tolerancia = 10n ** BigInt(DECIMALES_MAX - EXPONENTE_TOLERANCIA);
  if (diferencia > tolerancia || -diferencia > tolerancia) return null;
  const cifras = redondeado.toString().padStart(escala + 1, "0");
  return canonizarValor(escala === 0 ? cifras : `${cifras.slice(0, -escala)}.${cifras.slice(-escala)}`);
}

const normal = (texto: string): string => texto.normalize("NFC").replace(/\s+/gu, " ").trim().toLowerCase();
const ETIQUETAS_NORMALES = Object.freeze({
  mes: normal(ETIQUETAS_ANEXO_IPC.mes), titulo: normal(ETIQUETAS_ANEXO_IPC.titulo), numero: normal(ETIQUETAS_ANEXO_IPC.numero), base: normal(ETIQUETAS_ANEXO_IPC.base),
});
const MESES_NORMALES = MESES_ANEXO_IPC.map(normal);

const hijos = (el: ElementoXml, local: string, espacio: string = NS_MAIN): readonly ElementoXml[] =>
  el.hijos.filter((h) => h.local === local && h.espacio === espacio);

function exigirRaiz(el: ElementoXml, local: string, espacio: string): void {
  if (el.espacio === NS_STRICT) formato("STRICT");
  if (el.local !== local || el.espacio !== espacio) formato("RAIZ");
}

/** Una parte del zip, como XML; una que falta es DANE_FORMATO (no del lector). */
function parte(zip: ArchivoZip, nombre: string): ElementoXml {
  if (!zip.nombres.includes(nombre)) formato("PARTES");
  return leerXmlAcotado(zip.leer(nombre));
}

/** El r:id de la única hoja del libro. */
function idDeLaHoja(libro: ElementoXml): string {
  exigirRaiz(libro, "workbook", NS_MAIN);
  const listas = hijos(libro, "sheets");
  const hojas = listas.flatMap((l) => hijos(l, "sheet"));
  if (listas.length !== 1 || hojas.length !== 1) formato("HOJAS");
  return buscarAtributo(hojas[0]!, "id", NS_R) ?? formato("REL");
}

/** El nombre de la parte a la que apunta la relación, si es interna y cumple `patron`; si no, null. */
function destino(relacion: ElementoXml, patron: RegExp): string | null {
  const modo = buscarAtributo(relacion, "TargetMode");
  const objetivo = buscarAtributo(relacion, "Target");
  if ((modo !== undefined && modo !== "Internal") || objetivo === undefined) return null;
  const nombre = objetivo.startsWith("/") ? objetivo.slice(1) : `${CARPETA_LIBRO}${objetivo}`;
  return patron.test(nombre) ? nombre : null;
}

interface Destinos {
  readonly hoja: string;
  readonly textos: string;
}

function destinos(relaciones: ElementoXml, id: string): Destinos {
  exigirRaiz(relaciones, "Relationships", NS_RELACIONES);
  const todas = hijos(relaciones, "Relationship", NS_RELACIONES);
  const deLaHoja = todas.filter((r) => buscarAtributo(r, "Id") === id);
  const hoja = deLaHoja.length === 1 && buscarAtributo(deLaHoja[0]!, "Type") === TIPO_HOJA ? destino(deLaHoja[0]!, DESTINO_HOJA) : null;
  if (hoja === null) formato("REL");
  const deTextos = todas.filter((r) => buscarAtributo(r, "Type") === TIPO_TEXTOS);
  const textos = deTextos.length === 1 ? destino(deTextos[0]!, DESTINO_TEXTOS) : null;
  if (textos === null) formato("SST");
  return { hoja, textos };
}

/** El texto de un `<si>`: su `<t>` o la suma de los `<t>` de sus runs; la fonética (`rPh`) no cuenta. */
const textoDeTrozo = (h: ElementoXml): string => {
  if (h.espacio !== NS_MAIN) return "";
  if (h.local === "t") return h.texto;
  return h.local === "r" ? hijos(h, "t").map((t) => t.texto).join("") : "";
};

function leerTextos(sst: ElementoXml): readonly string[] {
  exigirRaiz(sst, "sst", NS_MAIN);
  return hijos(sst, "si").map((si) => si.hijos.map(textoDeTrozo).join(""));
}

interface Celda {
  readonly ref: string;
  readonly columna: number;
  readonly fila: number;
  /** El atributo t (por defecto n). */
  readonly tipo: string;
  /** El texto de `<v>`, o null si no hay. */
  readonly valor: string | null;
  readonly formula: boolean;
  readonly enLinea: boolean;
  /** El texto compartido, si es t="s" con valor. */
  readonly texto: string | null;
}

/** Las celdas CON contenido, por referencia, en el orden del documento. */
type Celdas = ReadonlyMap<string, Celda>;

const columnaDe = (letras: string): number => [...letras].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);

function letrasDe(columna: number): string {
  const resto = columna - 1;
  const letra = String.fromCharCode(65 + (resto % 26));
  return resto < 26 ? letra : `${letrasDe(Math.floor(resto / 26))}${letra}`;
}

const referencia = (columna: number, fila: number): string => `${letrasDe(columna)}${fila}`;

function textoCompartido(indice: string, textos: readonly string[], ref: string): string {
  const texto = INDICE_TEXTO.test(indice) ? textos[Number(indice)] : undefined;
  return texto ?? formato("SST", ref);
}

function leerCelda(c: ElementoXml, fila: number, textos: readonly string[]): Celda {
  const m = REFERENCIA.exec(buscarAtributo(c, "r") ?? "");
  if (!m || Number(m[2]) !== fila) formato("REF");
  const ref = m[0];
  const tipo = buscarAtributo(c, "t") ?? "n";
  if (!TIPOS_OOXML.has(tipo)) formato("TIPO", ref);
  const valor = hijos(c, "v")[0]?.texto ?? null;
  const texto = tipo === "s" && valor !== null ? textoCompartido(valor, textos, ref) : null;
  return { ref, columna: columnaDe(m[1]!), fila, tipo, valor, formula: hijos(c, "f").length > 0, enLinea: hijos(c, "is").length > 0, texto };
}

const vacia = (c: Celda): boolean => c.valor === null && !c.formula && !c.enLinea;

/** Las celdas de la hoja: filas con r ascendente, celdas con r de su fila y sin repetir; las vacías no se guardan. */
function leerCeldas(hoja: ElementoXml, textos: readonly string[]): Celdas {
  exigirRaiz(hoja, "worksheet", NS_MAIN);
  const datos = hijos(hoja, "sheetData");
  if (datos.length !== 1) formato("RAIZ");
  const celdas = new Map<string, Celda>();
  const vistas = new Set<string>();
  let anterior = 0;
  for (const fila of hijos(datos[0]!, "row")) {
    const r = buscarAtributo(fila, "r") ?? "";
    if (!NUMERO_FILA.test(r) || Number(r) <= anterior) formato("REF");
    anterior = Number(r);
    for (const c of hijos(fila, "c")) {
      const celda = leerCelda(c, anterior, textos);
      if (vistas.has(celda.ref)) formato("REF");
      vistas.add(celda.ref);
      if (!vacia(celda)) celdas.set(celda.ref, celda);
    }
  }
  return celdas;
}

/** La celda «Mes» (una sola), después de exigir el título, «Número Índice» y la base. */
function ubicarMes(celdas: Celdas): Celda {
  const conTexto = [...celdas.values()].filter((c) => c.texto !== null);
  const con = (etiqueta: string): readonly Celda[] => conTexto.filter((c) => normal(c.texto!) === etiqueta);
  const mes = con(ETIQUETAS_NORMALES.mes);
  if (mes.length !== 1) formato("MES");
  if (con(ETIQUETAS_NORMALES.titulo).length === 0 || con(ETIQUETAS_NORMALES.numero).length === 0) formato("TITULO");
  if (con(ETIQUETAS_NORMALES.base).length === 0) rechazo("DANE_BASE_DISTINTA");
  return mes[0]!;
}

const esNumeroEscrito = (c: Celda): boolean => c.tipo === "n" && !c.formula && !c.enLinea && c.valor !== null && c.valor !== "";

/** Los años a la derecha de «Mes», hasta la primera celda vacía: consecutivos y a lo sumo MAX_ANIOS_ANEXO. */
function leerAnios(celdas: Celdas, mes: Celda): readonly number[] {
  const anios: number[] = [];
  for (let columna = mes.columna + 1; ; columna += 1) {
    const c = celdas.get(referencia(columna, mes.fila));
    if (c === undefined) break;
    if (anios.length === MAX_ANIOS_ANEXO) formato("TOPE_ANIOS", c.ref);
    const anio = esNumeroEscrito(c) && ANIO.test(c.valor!) ? Number(c.valor) : null;
    const anterior = anios.at(-1);
    if (anio === null || (anterior !== undefined && anio !== anterior + 1)) rechazo("DANE_ANIOS", c.ref);
    anios.push(anio);
  }
  if (anios.length === 0) rechazo("DANE_ANIOS", referencia(mes.columna + 1, mes.fila));
  return anios;
}

/** Los 12 meses debajo de «Mes», en orden; y nada con valor a la derecha del último año en las 13 filas. */
function comprobarMesesYBordes(celdas: Celdas, mes: Celda, ultimaColumna: number): void {
  MESES_NORMALES.forEach((nombre, m) => {
    const ref = referencia(mes.columna, mes.fila + 1 + m);
    if (normal(celdas.get(ref)?.texto ?? "") !== nombre) rechazo("DANE_MES_DESCONOCIDO", ref);
  });
  const enLaTabla = (c: Celda) => c.fila >= mes.fila && c.fila < mes.fila + FILAS_TABLA;
  const fuera = [...celdas.values()].find((c) => enLaTabla(c) && c.columna > ultimaColumna);
  if (fuera) formato("FUERA_DE_TABLA", fuera.ref);
}

/** El valor de una celda de la tabla: número escrito, redondeado a la escala y dentro del rango del catálogo. */
function valorDe(c: Celda, serie: SerieCatalogo): string {
  if (!esNumeroEscrito(c)) rechazo("DANE_CELDA", c.ref);
  const valor = redondearIndice(c.valor!, serie.escala);
  if (valor === null) rechazo("DANE_VALOR", c.ref);
  const dentro = compararDecimales(valor, serie.rango.min) >= 0 && compararDecimales(valor, serie.rango.max) <= 0;
  return dentro ? valor : rechazo("VALOR_FUERA_DE_RANGO", c.ref);
}

interface MesDeLaTabla {
  readonly ref: string;
  readonly desde: Date;
  readonly hasta: Date;
  readonly valor: string | null;
}

/** Los meses publicados, en orden cronológico: sin huecos, al menos uno y todos ya terminados. */
function leerValores(celdas: Celdas, mes: Celda, anios: readonly number[], serie: SerieCatalogo, hoy: Date): readonly ValorSerie[] {
  const meses: readonly MesDeLaTabla[] = anios.flatMap((anio, i) =>
    MESES_NORMALES.map((_nombre, m) => {
      const ref = referencia(mes.columna + 1 + i, mes.fila + 1 + m);
      const c = celdas.get(ref);
      return { ref, desde: new Date(Date.UTC(anio, m, 1)), hasta: new Date(Date.UTC(anio, m + 1, 0)), valor: c === undefined ? null : valorDe(c, serie) };
    }),
  );
  const ultimo = meses.findLastIndex((x) => x.valor !== null);
  const hueco = meses.slice(0, Math.max(ultimo, 0)).find((x) => x.valor === null);
  if (hueco) rechazo("DANE_HUECO", hueco.ref);
  if (ultimo === -1) rechazo("SIN_VALORES");
  const publicados = meses.slice(0, ultimo + 1);
  const abierto = publicados.find((x) => x.hasta.getTime() >= hoy.getTime());
  if (abierto) rechazo("MES_ABIERTO", abierto.ref);
  return Object.freeze(publicados.map((x) => Object.freeze({ desde: x.desde, hasta: x.hasta, valor: x.valor! })));
}

function leer(bytes: Uint8Array, hoy: Date, serie: SerieCatalogo): readonly ValorSerie[] {
  const zip = abrirZipAcotado(bytes);
  const id = idDeLaHoja(parte(zip, PARTE_LIBRO));
  const { hoja, textos } = destinos(parte(zip, PARTE_RELACIONES), id);
  // Los textos antes que la hoja (la precedencia del encabezado): JavaScript evalúa los argumentos en orden.
  const textosCompartidos = leerTextos(parte(zip, textos));
  const celdas = leerCeldas(parte(zip, hoja), textosCompartidos);
  const mes = ubicarMes(celdas);
  const anios = leerAnios(celdas, mes);
  comprobarMesesYBordes(celdas, mes, mes.columna + anios.length);
  return leerValores(celdas, mes, anios, serie, hoy);
}

/**
 * Lee el anexo entero (todo o nada). `hoy` es la fecha de negocio en Colombia (fechaEnBogota): un mes que termina hoy o
 * después no entra. `serie` es la del catálogo; se inyecta solo en las pruebas. Nunca lanza.
 */
// El `as`: el catálogo siempre trae IPC_INDICE (catalogo.test.ts); si faltara, el TypeError sale ERROR_INTERNO.
export function leerAnexoIpc(bytes: Uint8Array, hoy: Date, serie: SerieCatalogo = serieDelCatalogo(SERIE_IPC) as SerieCatalogo): LecturaAnexoIpc {
  try {
    return { ok: true, valores: leer(bytes, hoy, serie) };
  } catch (e) {
    if (e instanceof FalloIpc) return e.fallo;
    if (e instanceof ErrorZip) return armarFallo("ANEXO_ZIP", e.codigo);
    if (e instanceof ErrorXml) return armarFallo("ANEXO_XML", e.codigo);
    return armarFallo("ERROR_INTERNO");
  }
}

/** `❌ CODIGO[ · detalle][ · celda X] · mensaje fijo`. */
export function mensajeFalloIpc(f: FalloAnexoIpc): string {
  const partes = [`❌ ${f.codigo}`, f.detalle, f.celda === undefined ? undefined : `celda ${f.celda}`, MENSAJES[f.codigo]];
  return partes.filter((p) => p !== undefined).join(" · ");
}

/** Lo que el CLI hace: el código de salida, el CSV para stdout (o null) y las líneas para stderr. */
export interface SalidaExportarIpc {
  readonly codigoSalida: 0 | 1 | 2;
  readonly csv: string | null;
  readonly lineas: readonly string[];
}

const salida = (codigoSalida: SalidaExportarIpc["codigoSalida"], lineas: readonly string[], csv: string | null = null): SalidaExportarIpc =>
  Object.freeze({ codigoSalida, csv, lineas: Object.freeze([...lineas]) });
const NO_SE_ESCRIBIO = "No se escribió el CSV.";
const mesIso = (d: Date): string => diaIso(d).slice(0, 7);

/** El anexo → el CSV canónico (el que importar-series vuelve a leer) y su resumen, sin valores. */
export function exportarIpc(bytes: Uint8Array, hoy: Date, catalogo: readonly SerieCatalogo[] = CATALOGO): SalidaExportarIpc {
  const serie = catalogo.find((s) => s.codigo === SERIE_IPC);
  if (serie === undefined) return salida(1, [`${mensajeFalloIpc(armarFallo("ERROR_INTERNO"))} ${NO_SE_ESCRIBIO}`]);
  const r = leerAnexoIpc(bytes, hoy, serie);
  if (!r.ok) return salida(1, [`${mensajeFalloIpc(r)} ${NO_SE_ESCRIBIO}`]);
  const escrito = escribirCsvSeries([{ codigo: SERIE_IPC, valores: r.valores }], hoy, catalogo);
  if (!escrito.ok) return salida(1, [`❌ CSV_${escrito.codigo} · el CSV no pasaría la lectura de importar-series. ${NO_SE_ESCRIBIO}`]);
  const [primero, ultimo] = [r.valores[0]!, r.valores[r.valores.length - 1]!];
  const resumen = `✅ ${SERIE_IPC} · ${r.valores.length} meses · del ${mesIso(primero.desde)} al ${mesIso(ultimo.desde)} · ${serie.fuente}`;
  return salida(0, [
    `${resumen} · solo el índice: la variación no se importa (la calcula 008).`,
    "   Siguiente paso: npx tsx scripts/importar-series.ts --archivo <ipc.csv> (en producción, por la vía B).",
  ], escrito.texto);
}

export const USO_EXPORTAR_IPC = [
  "Uso: npx tsx scripts/exportar-ipc.ts --archivo <anex-IPC-Indices.xlsx> > <ipc.csv.parcial> && mv <ipc.csv.parcial> <ipc.csv>",
  "  Lee el anexo de índices del IPC que usted baja del DANE (su ruta cambia cada mes: no se pide nada a la red) y escribe",
  "  por stdout el CSV de series oficiales (IPC_INDICE) que carga importar-series. Solo el índice (base dic-2018 = 100): la",
  "  variación no se importa. Un mes que no ha terminado no entra (MES_ABIERTO). Se niega a escribir en una terminal.",
  `  Tope del anexo: ${MAX_BYTES_ANEXO_IPC} bytes. Por stderr, solo conteos, meses, códigos y celdas; nunca valores.`,
  "  Salida: 0 bien · 2 uso, terminal o anexo ilegible · 1 anexo rechazado o demasiado grande, o la salida se cerró.",
].join("\n");

const VARIABLE_DE_NPM = "npm_config_archivo";

/**
 * Solo `--archivo <ruta>`, una vez (las reglas de src/datos-oficiales/series/argumentos.ts). Sin ningún argumento, el
 * mensaje dice el anexo; si npm se quedó con la opción, lo dice aquella. Lanza ErrorArgumentosCarga.
 */
export function leerArgumentosExportarIpc(argv: readonly string[], entorno: Readonly<Record<string, string | undefined>>): ArgumentosImportarSeries {
  if (argv.length === 0 && entorno[VARIABLE_DE_NPM] === undefined) throw new ErrorArgumentosCarga("Falta --archivo <anexo.xlsx>.");
  return leerArgumentosImportarSeries(argv, entorno);
}

export function salidaUsoIpc(mensaje: string): SalidaExportarIpc {
  return salida(2, [`❌ ${mensaje}`, USO_EXPORTAR_IPC]);
}

/** El fallo al leer el archivo, sin la ruta: demasiado grande es 1 (no es el anexo); ilegible o no regular, 2. */
export function salidaArchivoIpc(codigo: Extract<ResultadoArchivo, { readonly ok: false }>["codigo"]): SalidaExportarIpc {
  if (codigo === "ARCHIVO_DEMASIADO_GRANDE") return salida(1, [`❌ ANEXO_DEMASIADO_GRANDE · el anexo pasa de ${MAX_BYTES_ANEXO_IPC} bytes (el del DANE pesa unas decenas de KB). ${NO_SE_ESCRIBIO}`]);
  const nombre = codigo === "ARCHIVO_NO_REGULAR" ? "ANEXO_NO_REGULAR" : "ANEXO_ILEGIBLE";
  return salida(2, [`❌ ${nombre} · no se pudo leer el anexo indicado (debe ser un archivo regular).`]);
}

export const SALIDA_TERMINAL_IPC = salida(2, ["❌ SALIDA_TERMINAL · el CSV va a un archivo (> …), nunca a la pantalla: no se leyó el anexo."]);
export const SALIDA_CERRADA_IPC = salida(1, ["❌ SALIDA_CERRADA · no se pudo escribir el CSV completo (¿se cerró el tubo o se llenó el disco?): no lo use."]);

/** Escribe las líneas por stderr (stdout es solo del CSV) y devuelve el código de salida. */
export function emitirIpc(s: SalidaExportarIpc, consola: { readonly error: (linea: string) => void }): number {
  for (const linea of s.lineas) consola.error(linea);
  return s.codigoSalida;
}
