/**
 * Generador del anexo de índices del IPC del DANE (`anex-IPC-Indices`, xlsx) para las pruebas de
 * src/datos-oficiales/fuentes/dane-ipc.ts. Copia SOLO la FORMA del anexo real (verificada el 2026-11-21 en una descarga
 * pública): libro de una hoja con su relación, textos compartidos (algunos con runs), la celda «Mes» con los años a la
 * derecha y los 12 meses debajo, las celdas vacías con estilo de los meses no publicados y los artefactos del float.
 * Todo valor es INVENTADO (desde 413,29, de 0,37 en 0,37: lejos de la serie real) y los años son anteriores a 2022. No
 * se versiona ningún .xlsx: se arma en código con `armarZip` (tests/unit/lib/fixtures/xlsx.ficticio.ts). Las etiquetas,
 * los meses y las referencias de celda se escriben aquí aparte, sin importar el módulo: así un error compartido se nota.
 */
import { armarZip, ascii } from "../lib/fixtures/xlsx.ficticio";

export const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
export const NS_STRICT = "http://purl.oclc.org/ooxml/spreadsheetml/main";
export const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
export const NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const NS_MC = "http://schemas.openxmlformats.org/markup-compatibility/2006";
const NS_X14AC = "http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac";

export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"] as const;
export const TITULO = "Total, Índice de Precios al Consumidor (IPC)";
export const NUMERO_INDICE = "Número Índice";
export const BASE = "Base Diciembre de 2018 = 100,00";
export const MES = "Mes";

export const PARTE_HOJA = "xl/worksheets/sheet1.xml";
export const PARTE_TEXTOS = "xl/sharedStrings.xml";
export const PARTE_LIBRO = "xl/workbook.xml";
export const PARTE_RELS = "xl/_rels/workbook.xml.rels";

/** Centésimas inventadas del mes k (k = 0 es enero del primer año). */
export const centesimas = (k: number): number => 41_329 + 37 * k;

/** El valor canónico que tiene que salir en el CSV para el mes k (sin ceros sobrantes). */
export function valorCanonico(k: number): string {
  const c = centesimas(k);
  const fraccion = String(c % 100).padStart(2, "0").replace(/0+$/, "");
  return fraccion === "" ? String(Math.floor(c / 100)) : `${Math.floor(c / 100)}.${fraccion}`;
}

const conDosDecimales = (c: number): string => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, "0")}`;

/** Como lo deja Excel: a veces el artefacto del float por arriba (k % 7 = 2) o por abajo (k % 7 = 5), si no lo canónico. */
export function valorComoExcel(k: number): string {
  if (k % 7 === 2) return `${conDosDecimales(centesimas(k))}000000000004`;
  if (k % 7 === 5) return `${conDosDecimales(centesimas(k) - 1)}99999999999998`;
  return valorCanonico(k);
}

/** Letras de la columna n (1 = A). */
export function letras(n: number): string {
  let resto = n;
  let salida = "";
  while (resto > 0) {
    const d = (resto - 1) % 26;
    salida = String.fromCharCode(65 + d) + salida;
    resto = Math.floor((resto - 1) / 26);
  }
  return salida;
}
const numeroDeColumna = (l: string): number => [...l].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
export const ref = (columna: number, fila: number): string => `${letras(columna)}${fila}`;

export const celdaNumero = (r: string, v: string): string => `<c r="${r}" s="10"><v>${v}</v></c>`;
export const celdaTexto = (r: string, indice: number): string => `<c r="${r}" s="14" t="s"><v>${indice}</v></c>`;
const celdaVacia = (r: string): string => `<c r="${r}" s="10"/>`;

export interface OpcionesAnexo {
  /** 1997 por defecto. */
  readonly primerAnio?: number;
  /** 3 por defecto. */
  readonly anios?: number;
  /** Meses publicados desde enero del primer año (31 por defecto: hasta julio del tercer año). */
  readonly publicados?: number;
  /** "A" por defecto. */
  readonly columnaMes?: string;
  /** 9 por defecto; al menos 8 (las etiquetas van en las filas de arriba). */
  readonly filaMes?: number;
  /** El XML de la celda del valor del mes k; "" la quita; undefined deja la de siempre. */
  readonly valor?: (k: number, r: string) => string | undefined;
  /** El XML de la celda del año i (0 = el primero); "" la quita. */
  readonly anio?: (i: number, r: string) => string | undefined;
  /** El XML de la celda del mes m (0 = enero) en la columna de «Mes»; "" la quita. */
  readonly mes?: (m: number, r: string) => string | undefined;
  /** Textos compartidos de las etiquetas (null pone en su lugar una etiqueta ficticia). */
  readonly etiquetas?: Partial<Readonly<Record<"mes" | "titulo" | "numero" | "base", string | null>>>;
  /** Celdas sueltas (XML) que se agregan al final de la fila de los años y de cada fila de mes (m). */
  readonly extraFilaAnios?: string;
  readonly extraFilaMes?: (m: number) => string;
  /** Transformaciones del XML final de cada parte (mutaciones). */
  readonly hoja?: (xml: string) => string;
  readonly textos?: (xml: string) => string;
  readonly libro?: (xml: string) => string;
  readonly rels?: (xml: string) => string;
  /** Partes del zip que se agregan, reemplazan (texto) o quitan (null). */
  readonly partes?: Readonly<Record<string, string | null>>;
}

/** Índices fijos de los textos compartidos (en el mismo orden que el anexo real). */
const T = { fuente: 0, enero: 1, base: 13, mes: 14, nota: 15, serie: 16, numero: 17, titulo: 18, actualizado: 19 } as const;

function textosCompartidos(o: OpcionesAnexo): string {
  const etiqueta = (clave: "mes" | "titulo" | "numero" | "base", porDefecto: string): string => {
    const valor = o.etiquetas?.[clave];
    return valor === undefined ? porDefecto : (valor ?? `Etiqueta ficticia ${clave}`);
  };
  const si = (texto: string) => `<si><t>${texto}</t></si>`;
  const lista = [
    '<si><r><rPr><b/><sz val="8"/></rPr><t>Fuente:</t></r><r><rPr><sz val="8"/></rPr><t xml:space="preserve"> DANE (ficticio).</t></r></si>',
    ...MESES.map(si),
    si(etiqueta("base", BASE)),
    si(etiqueta("mes", MES)),
    '<si><r><rPr><b/></rPr><t>Nota:</t></r><r><t xml:space="preserve"> texto ficticio.</t></r></si>',
    si("Índices - Serie de empalme ficticia\n1997 - 1999"),
    si(etiqueta("numero", NUMERO_INDICE)),
    si(etiqueta("titulo", TITULO)),
    si("Actualizado el 17 de marzo de 2027 (ficticio)"),
  ];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="${NS_MAIN}" count="${lista.length}" uniqueCount="${lista.length}">${lista.join("")}</sst>`;
}

const fila = (r: number, celdas: readonly string[]): string => `<row r="${r}" spans="1:28" x14ac:dyDescent="0.2">${celdas.join("")}</row>`;
const elegir = (propia: string | undefined, porDefecto: string): string => (propia === undefined ? porDefecto : propia);

function filasDeLaTabla(o: Required<Pick<OpcionesAnexo, "primerAnio" | "anios" | "publicados" | "columnaMes" | "filaMes">> & OpcionesAnexo): string[] {
  const colMes = numeroDeColumna(o.columnaMes);
  const anios = Array.from({ length: o.anios }, (_v, i) => {
    const r = ref(colMes + 1 + i, o.filaMes);
    return elegir(o.anio?.(i, r), celdaNumero(r, String(o.primerAnio + i)));
  });
  const cabecera = fila(o.filaMes, [celdaTexto(ref(colMes, o.filaMes), T.mes), ...anios, o.extraFilaAnios ?? ""]);
  const meses = MESES.map((_n, m) => {
    const filaM = o.filaMes + 1 + m;
    const etiqueta = elegir(o.mes?.(m, ref(colMes, filaM)), celdaTexto(ref(colMes, filaM), T.enero + m));
    const valores = Array.from({ length: o.anios }, (_v, i) => {
      const k = i * 12 + m;
      const r = ref(colMes + 1 + i, filaM);
      return elegir(o.valor?.(k, r), k < o.publicados ? celdaNumero(r, valorComoExcel(k)) : celdaVacia(r));
    });
    return fila(filaM, [etiqueta, ...valores, o.extraFilaMes?.(m) ?? ""]);
  });
  return [cabecera, ...meses];
}

/** La hoja del anexo (XML), con las mutaciones de `o`. */
export function hojaAnexo(o: OpcionesAnexo = {}): string {
  const d = { primerAnio: 1997, anios: 3, publicados: 31, columnaMes: "A", filaMes: 9, ...o };
  const ultimaColumna = letras(numeroDeColumna(d.columnaMes) + d.anios);
  const filas = [
    fila(1, [celdaVacia("A1"), celdaVacia("B1")]),
    fila(d.filaMes - 6, [celdaTexto(`A${d.filaMes - 6}`, T.titulo)]),
    fila(d.filaMes - 4, [celdaTexto(`A${d.filaMes - 4}`, T.serie)]),
    fila(d.filaMes - 2, [celdaTexto(`A${d.filaMes - 2}`, T.numero)]),
    fila(d.filaMes - 1, [celdaVacia(`A${d.filaMes - 1}`), celdaTexto(`${ultimaColumna}${d.filaMes - 1}`, T.base)]),
    ...filasDeLaTabla(d),
    fila(d.filaMes + 14, [celdaTexto(`A${d.filaMes + 14}`, T.fuente)]),
    fila(d.filaMes + 15, [celdaTexto(`A${d.filaMes + 15}`, T.nota)]),
    fila(d.filaMes + 16, [celdaTexto(`A${d.filaMes + 16}`, T.actualizado)]),
  ];
  const xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}" xmlns:mc="${NS_MC}" mc:Ignorable="x14ac" xmlns:x14ac="${NS_X14AC}">` +
    `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:AB${d.filaMes + 16}"/><sheetFormatPr defaultRowHeight="14.25" x14ac:dyDescent="0.25"/>` +
    `<sheetData>${filas.join("")}</sheetData><mergeCells count="1"><mergeCell ref="A${d.filaMes - 6}:${ultimaColumna}${d.filaMes - 5}"/></mergeCells></worksheet>`;
  return o.hoja ? o.hoja(xml) : xml;
}

const LIBRO = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS_MAIN}" xmlns:r="${NS_R}"><workbookPr/><bookViews><workbookView xWindow="-120" yWindow="-120"/></bookViews><sheets><sheet name="IndicesIPC" sheetId="520" r:id="rId1"/></sheets><calcPr calcId="191029"/></workbook>`;
const RELS = [
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS_REL}">`,
  `<Relationship Id="rId3" Type="${NS_R}/styles" Target="styles.xml"/>`,
  `<Relationship Id="rId2" Type="${NS_R}/theme" Target="theme/theme1.xml"/>`,
  `<Relationship Id="rId1" Type="${NS_R}/worksheet" Target="worksheets/sheet1.xml"/>`,
  `<Relationship Id="rId4" Type="${NS_R}/sharedStrings" Target="sharedStrings.xml"/>`,
  "</Relationships>",
].join("");
const TIPOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="png" ContentType="image/png"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>`;
const RAIZ_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS_REL}"><Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${NS_MAIN}"><numFmts count="0"/></styleSheet>`;
/** Una imagen ficticia (no es un PNG real: el lector nunca la abre), almacenada sin comprimir como en el anexo. */
const IMAGEN = Uint8Array.from({ length: 233 }, (_v, k) => (k * 37 + 11) % 256);

/** El anexo entero (bytes del xlsx), con las mutaciones de `o`. */
export function anexoIpc(o: OpcionesAnexo = {}): Uint8Array {
  const partes = new Map<string, string | Uint8Array>([
    ["[Content_Types].xml", TIPOS],
    ["_rels/.rels", RAIZ_RELS],
    [PARTE_LIBRO, o.libro ? o.libro(LIBRO) : LIBRO],
    [PARTE_RELS, o.rels ? o.rels(RELS) : RELS],
    [PARTE_HOJA, hojaAnexo(o)],
    ["xl/styles.xml", ESTILOS],
    [PARTE_TEXTOS, o.textos ? o.textos(textosCompartidos(o)) : textosCompartidos(o)],
    ["xl/media/image1.png", IMAGEN],
  ]);
  for (const [nombre, contenido] of Object.entries(o.partes ?? {})) {
    if (contenido === null) partes.delete(nombre);
    else partes.set(nombre, contenido);
  }
  return armarZip(
    [...partes].map(([nombre, contenido]) =>
      typeof contenido === "string" ? { nombre, datos: ascii(contenido) } : { nombre, datos: contenido, metodo: 0 },
    ),
  );
}

const dia = (anio: number, mes0: number, d: number): string => new Date(Date.UTC(anio, mes0, d)).toISOString().slice(0, 10);

/** El CSV canónico que tiene que salir del anexo por defecto (o de `publicados` meses desde enero de `primerAnio`). */
export function csvEsperado(publicados = 31, primerAnio = 1997): string {
  const filas = Array.from({ length: publicados }, (_v, k) => {
    const [anio, mes0] = [primerAnio + Math.floor(k / 12), k % 12];
    return `IPC_INDICE,${dia(anio, mes0, 1)},${dia(anio, mes0 + 1, 0)},${valorCanonico(k)},dane:anex-IPC-Indices`;
  });
  return `${["serie,desde,hasta,valor,fuente", ...filas].join("\n")}\n`;
}
