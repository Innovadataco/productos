/**
 * Generador del PDF FICTICIO de la certificación de Acciones & Valores, para las pruebas del lector.
 * Imita la ESTRUCTURA que escribe jsPDF en el portal (verificada en local sin copiar datos): 2 páginas A4,
 * fuentes estándar con WinAnsi sin incrustar, una celda = un `BT … x y Td (texto) Tj ET`, pie pintado dos
 * veces por página (multilínea con T*), imagen de logo, /Info con CreationDate y xref clásica.
 * TODOS los datos son inventados (FICT1…, montos redondos). Nunca se deriva de un PDF real.
 */
import { deflateSync } from "node:zlib";

export interface FondoFicticio {
  readonly descripcion: string;
  readonly nit: string;
  readonly encargo: string;
  readonly saldo: string;
}

export interface PosicionFicticia {
  readonly nemo: string;
  readonly cantidad: string;
  readonly precio: string;
  readonly valor: string;
}

export interface EfectivoFicticio {
  readonly nombre: string;
  readonly cuenta: string;
  readonly saldo: string;
}

export interface EspecCertificacion {
  readonly fondos: readonly FondoFicticio[];
  readonly rentaVariable: readonly PosicionFicticia[];
  readonly efectivo: readonly EfectivoFicticio[];
  /** Fecha de generación en formato PDF («D:AAAAMMDDhhmmss-05'00'»); null = sin CreationDate. */
  readonly creadoEn: string | null;
}

export interface OpcionesPdf {
  /** Content streams en FlateDecode (jsPDF con `compress: true`). */
  readonly comprimir?: boolean;
  /** Cuántas filas de renta variable pasan a la página 2 (la sección sigue en otra página). */
  readonly rvEnPagina2?: number;
  /** Al seguir en la página 2, si se repite el encabezado de columnas. */
  readonly repetirEncabezado?: boolean;
  /** Pie pintado dos veces por página (como el portal). Por defecto, sí. */
  readonly pieDoble?: boolean;
  /** Operadores crudos que se agregan al final del contenido de la página 1 (pruebas de rechazo). */
  readonly contenidoExtra?: string;
  /** Diccionario de /F1 (pruebas de fuentes): reemplaza al de Helvetica. */
  readonly fuenteF1?: string;
  /** Texto crudo que se agrega dentro del diccionario del trailer (p. ej. «/Encrypt 99 0 R»). */
  readonly trailerExtra?: string;
  /** /Contents como arreglo de referencias («[4 0 R]») en vez de una referencia sola. */
  readonly contenidosEnArreglo?: boolean;
  /** Imagen como PNG de jsPDF (Flate con /DecodeParms y predictor) en vez de JPEG (DCT). */
  readonly imagenConPredictor?: boolean;
  /** Con comprimir: los content streams llevan /DecodeParms (predictor), que el lector no soporta. */
  readonly decodeParmsEnContenido?: boolean;
  /** Páginas en blanco que se agregan al final de /Kids (pruebas del tope de páginas). */
  readonly paginasVacias?: number;
  /** /Rotate en el nodo /Pages (se hereda a cada página). */
  readonly rotar?: number;
  /** /CropBox de la página 1, tal cual (p. ej. «[0 0 300 300]»). */
  readonly cropBox?: string;
  /** /Contents de la página 1 = la misma referencia repetida n veces (bomba de inflado). */
  readonly repetirFlujo?: number;
  /** Streams de contenido distintos que se agregan a /Contents de la página 1. */
  readonly flujosExtra?: { readonly cuantos: number; readonly contenido: string };
  /** /Contents de la página 1 como referencia indirecta a un arreglo de referencias. */
  readonly contenidosIndirectos?: boolean;
}

export const CERTIFICACION_FICTICIA: EspecCertificacion = {
  fondos: [{ descripcion: "FONDO FICTICIO INMOBILIARIO UNO", nit: "999000111-0", encargo: "000000001", saldo: "COP 5.000.000,00" }],
  rentaVariable: [
    { nemo: "FICT1", cantidad: "100", precio: "COP 1.000,00", valor: "COP 100.000,00" },
    { nemo: "FICT1", cantidad: "50", precio: "COP 1.000,00", valor: "COP 50.000,00" },
    { nemo: "FICT2", cantidad: "2000", precio: "COP 20,00", valor: "COP 40.000,00" },
    { nemo: "FICT3", cantidad: "10", precio: "COP 30.000,00", valor: "COP 300.000,00" },
  ],
  efectivo: [{ nombre: "Titular Ficticio Uno", cuenta: "00000", saldo: "COP 1.000,00" }],
  creadoEn: "D:20240105101500-05'00'",
};

const ALTO = 841.89;
const ANCHO = 595.28;
const ESPECIALES: Readonly<Record<string, number>> = { "€": 0x80, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97 };

/** Texto → bytes WinAnsi (cp1252) como cadena latin1, con `\`, `(` y `)` escapados. */
export function winAnsi(texto: string): string {
  return [...texto]
    .map((c) => {
      const especial = ESPECIALES[c];
      const codigo = especial ?? c.charCodeAt(0);
      if (codigo > 0xff || (especial === undefined && codigo >= 0x80 && codigo <= 0x9f)) throw new Error("Carácter fuera de WinAnsi en el generador");
      const byte = String.fromCharCode(codigo);
      return byte === "\\" || byte === "(" || byte === ")" ? `\\${byte}` : byte;
    })
    .join("");
}

const n = (v: number) => v.toFixed(2);

/** Una celda como la escribe jsPDF: su propio bloque BT…ET con posición absoluta. */
function celda(x: number, y: number, texto: string, tamano = 9): string {
  return `BT\n/F1 ${tamano} Tf\n${n(tamano * 1.15)} TL\n0 g\n${n(x)} ${n(y)} Td\n(${winAnsi(texto)}) Tj\nET`;
}

/** Ancho aproximado para centrar (el lector no lo usa: solo varía la x como en el portal). */
const centrada = (centro: number, texto: string) => centro - texto.length * 2.2;

const FOOTER = [
  "Defensor del Consumidor Financiero Sr. Defensor Ficticio, Teléfono: 0000000, email: defensor@ejemplo.invalid",
  "Dirección: Calle Ficticia 0 \\ oficina 0 (sede de prueba)",
  "Horario de Atención: Lunes a Viernes 8:00AM -5:00PM.",
];

function pie(pagina: number): string {
  return [
    `BT\n/F1 6 Tf\n6.90 TL\n0 g\n${n(20)} ${n(90)} Td\n${FOOTER.map((l) => `(${winAnsi(l)}) Tj`).join("\nT*\n")}\nET`,
    celda(centrada(297, "WWW.EJEMPLO.INVALID"), 60, "WWW.EJEMPLO.INVALID", 7),
    `BT\n/F1 6 Tf\n6.90 TL\n0 g\n${n(20)} ${n(45)} Td\n(${winAnsi("Edificio Acciones & Valores S.A. – Teléfono (00-0) 000 00 00")}) Tj\nT*\n(${winAnsi("Línea de prueba 00 0000 000")}) Tj\nET`,
    celda(540, 20, `Página ${pagina}`, 7),
  ].join("\n");
}

interface Columna {
  readonly titulo: string;
  readonly centro: number;
}

const COL_FONDOS: readonly Columna[] = [
  { titulo: "DESCRIPCIÓN", centro: 130 }, { titulo: "NIT DEL FONDO", centro: 340 }, { titulo: "ENCARGO", centro: 430 }, { titulo: "SALDO", centro: 530 },
];
const COL_RV: readonly Columna[] = [
  { titulo: "NEMOTÉCNICO", centro: 70 }, { titulo: "CANTIDAD", centro: 200 }, { titulo: "PRECIO VALORACIÓN", centro: 320 }, { titulo: "VALOR DE MERCADO", centro: 480 },
];
const COL_EFECTIVO: readonly Columna[] = [{ titulo: "NOMBRE", centro: 130 }, { titulo: "CUENTA", centro: 340 }, { titulo: "SALDO", centro: 500 }];

function tabla(titulo: string | null, columnas: readonly Columna[], filas: readonly (readonly string[])[], y0: number, encabezado = true): { contenido: string[]; y: number } {
  const contenido: string[] = [];
  let y = y0;
  if (titulo) {
    contenido.push(celda(centrada(297, titulo), y, titulo, 10));
    y -= 25;
  }
  if (encabezado) {
    contenido.push(...columnas.map((c) => celda(centrada(c.centro, c.titulo), y, c.titulo, 8)));
    y -= 20;
  }
  for (const fila of filas) {
    contenido.push(...fila.map((texto, i) => celda(centrada(columnas[i]!.centro, texto), y, texto)));
    y -= 20;
  }
  return { contenido, y: y - 20 };
}

function paginas(espec: EspecCertificacion, o: OpcionesPdf): [string, string] {
  const enP2 = o.rvEnPagina2 ?? 0;
  const rv = espec.rentaVariable.map((f) => [f.nemo, f.cantidad, f.precio, f.valor] as const);
  const rv1 = rv.slice(0, rv.length - enP2);
  const rv2 = rv.slice(rv.length - enP2);
  const logo = `q\n${n(120)} 0 0 ${n(40)} ${n(40)} ${n(780)} cm\n/I0 Do\nQ`;
  const fondos = tabla("FONDOS DE INVERSIÓN", COL_FONDOS, espec.fondos.map((f) => [f.descripcion, f.nit, f.encargo, f.saldo]), 740);
  const variable = tabla("RENTA VARIABLE", COL_RV, rv1, fondos.y);
  const veces = o.pieDoble === false ? 1 : 2;
  const p1 = ["0.57 w\n0 G", logo, ...fondos.contenido, ...variable.contenido, ...Array.from({ length: veces }, () => pie(1)), o.contenidoExtra ?? ""];
  const seguida = rv2.length > 0 ? tabla(null, COL_RV, rv2, 760, o.repetirEncabezado ?? true) : { contenido: [], y: 760 };
  const efectivo = tabla("SALDO EN EFECTIVO", COL_EFECTIVO, espec.efectivo.map((f) => [f.nombre, f.cuenta, f.saldo]), seguida.y);
  const p2 = ["0.57 w\n0 G", logo, ...seguida.contenido, ...efectivo.contenido, ...Array.from({ length: veces }, () => pie(2))];
  return [p1.filter(Boolean).join("\n"), p2.join("\n")];
}

const FUENTES = ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique", "Courier", "Times-Roman", "Symbol", "ZapfDingbats"];

function diccionarioFuente(base: string): string {
  const codificacion = base === "Symbol" || base === "ZapfDingbats" ? "" : "\n/Encoding /WinAnsiEncoding";
  return `<<\n/Type /Font\n/BaseFont /${base}\n/Subtype /Type1${codificacion}\n/FirstChar 32\n/LastChar 255\n>>`;
}

/** Bytes «binarios» de la imagen falsa: incluyen `)`, `obj` y `endstream` para probar que se respeta /Length. */
const IMAGEN = Buffer.from([0xff, 0x29, 0x28, 0x5c, ...Buffer.from(" obj endstream BT (x) Tj ET "), 0x00, 0x96, 0xd3]);

/** Los datos de la imagen son falsos: el lector no debe decodificarlos nunca (ni DCT ni Flate con predictor). */
function filtroImagen(o: OpcionesPdf): string {
  return o.imagenConPredictor
    ? "/Filter /FlateDecode\n/DecodeParms <<\n/Predictor 15\n/Colors 1\n/BitsPerComponent 8\n/Columns 1\n>>\n"
    : "/Filter /DCTDecode\n";
}

type Objeto = string | { readonly dic: string; readonly datos: Buffer };

function flujo(contenido: string, o: OpcionesPdf): Objeto {
  const comprimir = o.comprimir ?? false;
  const datos = comprimir ? deflateSync(Buffer.from(contenido, "latin1")) : Buffer.from(contenido, "latin1");
  const parametros = comprimir && o.decodeParmsEnContenido ? "\n/DecodeParms << /Predictor 12 >>" : "";
  return { dic: `<<\n/Length ${datos.length}${comprimir ? "\n/Filter /FlateDecode" : ""}${parametros}\n>>`, datos };
}

/** Páginas en blanco (sin /Contents) numeradas desde 100. */
function vacias(o: OpcionesPdf): [number, string][] {
  return Array.from({ length: o.paginasVacias ?? 0 }, (_, i) => [100 + i, "<</Type /Page\n/Parent 1 0 R\n>>"]);
}

const PRIMER_EXTRA = 200;
const ARREGLO_INDIRECTO = 300;

/** /Contents de la página 1 según las opciones de prueba. */
function contenidosPagina1(o: OpcionesPdf): string {
  const refs = [4, ...Array.from({ length: o.flujosExtra?.cuantos ?? 0 }, (_, i) => PRIMER_EXTRA + i)].map((r) => `${r} 0 R`);
  if (o.repetirFlujo) return `[${Array.from({ length: o.repetirFlujo }, () => "4 0 R").join(" ")}]`;
  if (o.contenidosIndirectos) return `${ARREGLO_INDIRECTO} 0 R`;
  return o.contenidosEnArreglo || refs.length > 1 ? `[${refs.join(" ")}]` : refs[0]!;
}

function extras(o: OpcionesPdf): [number, Objeto][] {
  const flujos = Array.from({ length: o.flujosExtra?.cuantos ?? 0 }, (_, i): [number, Objeto] => [PRIMER_EXTRA + i, flujo(o.flujosExtra!.contenido, o)]);
  return o.contenidosIndirectos ? [...flujos, [ARREGLO_INDIRECTO, "[4 0 R]"]] : flujos;
}

function objetos(espec: EspecCertificacion, o: OpcionesPdf): Map<number, Objeto> {
  const [c1, c2] = paginas(espec, o);
  const pagina = (contenido: number) => {
    const contenidos = contenido === 4 ? contenidosPagina1(o) : o.contenidosEnArreglo ? `[${contenido} 0 R]` : `${contenido} 0 R`;
    const recorte = contenido === 4 && o.cropBox ? `\n/CropBox ${o.cropBox}` : "";
    return `<</Type /Page\n/Parent 1 0 R\n/Resources 2 0 R\n/MediaBox [0 0 ${n(ANCHO)} ${n(ALTO)}]${recorte}\n/Contents ${contenidos}\n>>`;
  };
  const fuentes = FUENTES.map((base, i) => [10 + i, i === 0 && o.fuenteF1 ? o.fuenteF1 : diccionarioFuente(base)] as const);
  const info = `<<\n/Producer (jsPDF 0.0.0-ficticio)${espec.creadoEn ? `\n/CreationDate (${espec.creadoEn})` : ""}\n>>`;
  return new Map<number, Objeto>([
    [3, pagina(4)], [4, flujo(c1, o)], [5, pagina(6)], [6, flujo(c2, o)],
    [1, `<</Type /Pages\n/Kids [3 0 R 5 0 R ${vacias(o).map(([num]) => `${num} 0 R `).join("")}]\n/Count ${2 + (o.paginasVacias ?? 0)}${o.rotar === undefined ? "" : `\n/Rotate ${o.rotar}`}\n/Resources 2 0 R\n/MediaBox [0 0 ${n(ANCHO)} ${n(ALTO)}]\n>>`],
    ...vacias(o),
    ...extras(o),
    ...fuentes,
    [2, `<<\n/ProcSet [/PDF /Text /ImageB /ImageC /ImageI]\n/Font <<\n${fuentes.map(([num], i) => `/F${i + 1} ${num} 0 R`).join("\n")}\n>>\n/XObject <<\n/I0 7 0 R\n>>\n>>`],
    [7, { dic: `<<\n/Type /XObject\n/Subtype /Image\n/Width 1\n/Height 1\n/ColorSpace /DeviceGray\n/BitsPerComponent 8\n/Length ${IMAGEN.length}\n${filtroImagen(o)}>>`, datos: IMAGEN }],
    [8, info],
    [9, "<<\n/Type /Catalog\n/Pages 1 0 R\n/OpenAction [3 0 R /FitH null]\n/PageLayout /OneColumn\n>>"],
  ]);
}

/** Arma el PDF con offsets reales en la xref. */
export function generarCertificacionPdf(espec: EspecCertificacion = CERTIFICACION_FICTICIA, opciones: OpcionesPdf = {}): Uint8Array {
  const piezas: Buffer[] = [Buffer.from("%PDF-1.3\n%\xba\xdf\xac\xe0\n", "latin1")];
  const offsets = new Map<number, number>();
  let largo = piezas[0]!.length;
  const agregar = (b: Buffer) => {
    piezas.push(b);
    largo += b.length;
  };
  const todos = objetos(espec, opciones);
  for (const [numero, objeto] of todos) {
    offsets.set(numero, largo);
    if (typeof objeto === "string") agregar(Buffer.from(`${numero} 0 obj\n${objeto}\nendobj\n`, "latin1"));
    else agregar(Buffer.concat([Buffer.from(`${numero} 0 obj\n${objeto.dic}\nstream\n`, "latin1"), objeto.datos, Buffer.from("\nendstream\nendobj\n", "latin1")]));
  }
  const total = Math.max(...todos.keys()) + 1;
  const xref = largo;
  const filas = Array.from({ length: total }, (_, i) => (i === 0 ? "0000000000 65535 f " : `${String(offsets.get(i) ?? 0).padStart(10, "0")} 00000 ${offsets.has(i) ? "n" : "f"} `));
  const trailer = `trailer\n<<\n/Size ${total}\n/Root 9 0 R\n/Info 8 0 R\n/ID [ <00112233445566778899AABBCCDDEEFF> <00112233445566778899AABBCCDDEEFF> ]${opciones.trailerExtra ? `\n${opciones.trailerExtra}` : ""}\n>>`;
  agregar(Buffer.from(`xref\n0 ${total}\n${filas.join("\n")}\n${trailer}\nstartxref\n${xref}\n%%EOF\n`, "latin1"));
  return new Uint8Array(Buffer.concat(piezas));
}
