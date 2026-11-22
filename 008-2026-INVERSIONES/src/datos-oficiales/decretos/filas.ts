/**
 * Una fila del CSV de decretos del dueño (fase C, C4a) → el decreto leído, o sus hallazgos (columna y código, nunca el
 * valor). Puro. Cada regla de dividendo_decretado (migración 20261122030100_datos_oficiales) tiene aquí su espejo, para
 * que la base nunca rechace a mitad de la transacción, después de retirar la versión anterior
 * (tests/unit/datos-oficiales/decretos/espejo-check.test.ts compara los literales con la migración):
 * - especie: nemotécnico de la BVC o símbolo de Trii (mayúsculas y números, 2 a 20);
 * - tipo: ORDINARIO o EXTRAORDINARIO (una fracción de escisión no es un decreto);
 * - fechas AAAA-MM-DD, con anuncio ≤ ex ≤ pago y un anuncio que no sea posterior a hoy (Bogotá). La fecha ex se
 *   registra tal como la publica la fuente: no se calcula;
 * - cuota de 1 a 12; valor por acción con punto, hasta 6 decimales y mayor que 0;
 * - P11: solo en pesos y en dinero (moneda COP, forma DINERO): un decreto en USD o en acciones rechaza el archivo;
 * - referencia oficial: una página de la SFC o de la BVC (https) o el radicado de la SFC (sfc:…), hasta 500;
 * - anulada SI (o SÍ), NO o vacía; nota de hasta 500 caracteres, obligatoria si la fila va anulada (P10).
 */
import { leerDecimal, leerFechaIso, leerNemotecnico, type ResultadoValor } from "../../importacion/trii/valores";
import type { Hallazgo } from "../registro/hallazgos";

export const COLUMNAS = [
  "especie", "tipo", "fecha_anuncio", "cuota", "valor_por_accion", "moneda", "forma", "fecha_ex", "fecha_pago", "referencia", "anulada", "nota",
] as const;
export type Columna = (typeof COLUMNAS)[number];

export type TipoDecreto = "ORDINARIO" | "EXTRAORDINARIO";

/** dividendo_decretado."valorPorAccion" es DECIMAL(20,6). */
export const ESCALA_VALOR = 6;
export const CUOTA_MIN = 1;
export const CUOTA_MAX = 12;
export const MAX_NOTA = 500;
export const MAX_REFERENCIA = 500;
/** Los mismos patrones que dividendo_decretado_referencia_chk, carácter por carácter. */
export const REFERENCIAS_OFICIALES: readonly string[] = [
  String.raw`^https://www\.superfinanciera\.gov\.co/[A-Za-z0-9._~/?=&%#:+-]+$`,
  String.raw`^https://www\.bvc\.com\.co/[A-Za-z0-9._~/?=&%#:+-]+$`,
  String.raw`^sfc:[A-Za-z0-9._-]{1,60}$`,
];
const REFERENCIAS = REFERENCIAS_OFICIALES.map((r) => new RegExp(r));

export interface DecretoLeido {
  /** Número del registro en el archivo (el encabezado es el 1). */
  readonly linea: number;
  readonly especie: string;
  readonly tipo: TipoDecreto;
  readonly fechaAnuncio: Date;
  readonly cuota: number;
  /** Texto decimal canónico (sin ceros de sobra), para Prisma.Decimal sin pasar por punto flotante. */
  readonly valorPorAccion: string;
  readonly fechaEx: Date;
  readonly fechaPago: Date;
  readonly referencia: string;
  readonly anulada: boolean;
  readonly nota: string | null;
}

export type LecturaFila = { readonly ok: true; readonly decreto: DecretoLeido } | { readonly ok: false; readonly hallazgos: readonly Hallazgo[] };

type R<T> = ResultadoValor<T>;
const bienV = <T>(valor: T): R<T> => ({ ok: true, valor });
const malV = <T>(codigo: string): R<T> => ({ ok: false, codigo });

function leerTipo(texto: string): R<TipoDecreto> {
  const t = texto.trim();
  return t === "ORDINARIO" || t === "EXTRAORDINARIO" ? bienV(t) : malV("TIPO_DESCONOCIDO");
}

function leerCuota(texto: string): R<number> {
  const t = texto.trim();
  if (!/^[0-9]{1,2}$/.test(t)) return malV("CUOTA_FORMATO");
  const n = Number(t);
  return n >= CUOTA_MIN && n <= CUOTA_MAX ? bienV(n) : malV("CUOTA_RANGO");
}

function leerValor(texto: string): R<string> {
  const r = leerDecimal(texto, ESCALA_VALOR);
  if (!r.ok) return r;
  return r.valor === "0" || r.valor.startsWith("-") ? malV("VALOR_NO_POSITIVO") : r;
}

const leerFijo = (esperado: string, codigo: string) => (texto: string): R<string> => (texto.trim() === esperado ? bienV(esperado) : malV(codigo));

function leerReferencia(texto: string): R<string> {
  const t = texto.trim();
  return t.length <= MAX_REFERENCIA && REFERENCIAS.some((r) => r.test(t)) ? bienV(t) : malV("REFERENCIA_NO_OFICIAL");
}

function leerAnulada(texto: string): R<boolean> {
  const t = texto.trim();
  if (t === "" || t === "NO") return bienV(false);
  return t === "SI" || t === "SÍ" ? bienV(true) : malV("ANULADA_FORMATO");
}

/** Recortada; vacía es «sin nota». El tope cuenta caracteres (puntos de código), como char_length de PostgreSQL. */
function leerNota(texto: string): R<string | null> {
  const t = texto.trim();
  if (t === "") return bienV(null);
  return Array.from(t).length <= MAX_NOTA ? bienV(t) : malV("NOTA_LARGA");
}

type Celdas = Readonly<Record<Columna, string>>;

/** Cada columna con su lector; los hallazgos, en el orden de las columnas. */
function leerColumnas(c: Celdas, linea: number, hallazgos: Hallazgo[]) {
  const tomar = <T>(columna: Columna, r: R<T>): T | undefined => {
    if (r.ok) return r.valor;
    hallazgos.push({ linea, columna, codigo: r.codigo });
    return undefined;
  };
  return {
    especie: tomar("especie", leerNemotecnico(c.especie)),
    tipo: tomar("tipo", leerTipo(c.tipo)),
    fechaAnuncio: tomar("fecha_anuncio", leerFechaIso(c.fecha_anuncio)),
    cuota: tomar("cuota", leerCuota(c.cuota)),
    valorPorAccion: tomar("valor_por_accion", leerValor(c.valor_por_accion)),
    moneda: tomar("moneda", leerFijo("COP", "MONEDA_NO_ADMITIDA")(c.moneda)),
    forma: tomar("forma", leerFijo("DINERO", "FORMA_NO_ADMITIDA")(c.forma)),
    fechaEx: tomar("fecha_ex", leerFechaIso(c.fecha_ex)),
    fechaPago: tomar("fecha_pago", leerFechaIso(c.fecha_pago)),
    referencia: tomar("referencia", leerReferencia(c.referencia)),
    anulada: tomar("anulada", leerAnulada(c.anulada)),
    nota: tomar("nota", leerNota(c.nota)),
  };
}

/** Las reglas entre columnas, solo con las columnas que se leyeron bien. */
function revisarCruces(v: ReturnType<typeof leerColumnas>, linea: number, hoy: Date): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  if (v.fechaAnuncio && v.fechaAnuncio > hoy) hallazgos.push({ linea, columna: "fecha_anuncio", codigo: "FECHA_ANUNCIO_FUTURA" });
  if (v.fechaAnuncio && v.fechaEx && v.fechaPago && (v.fechaAnuncio > v.fechaEx || v.fechaEx > v.fechaPago)) {
    hallazgos.push({ linea, columna: "fecha_ex", codigo: "FECHAS_INCOHERENTES" });
  }
  if (v.anulada === true && v.nota === null) hallazgos.push({ linea, columna: "nota", codigo: "NOTA_OBLIGATORIA" });
  return hallazgos;
}

/** `celdas` en el orden de COLUMNAS (el lector del archivo ya exigió el encabezado exacto); `hoy`, fecha de Bogotá. */
export function interpretarFila(celdas: readonly string[], linea: number, hoy: Date): LecturaFila {
  const c = Object.fromEntries(COLUMNAS.map((columna, i) => [columna, celdas[i] ?? ""])) as Celdas;
  const hallazgos: Hallazgo[] = [];
  const v = leerColumnas(c, linea, hallazgos);
  hallazgos.push(...revisarCruces(v, linea, hoy));
  if (hallazgos.length > 0) return { ok: false, hallazgos };
  const decreto: DecretoLeido = {
    linea, especie: v.especie!, tipo: v.tipo!, fechaAnuncio: v.fechaAnuncio!, cuota: v.cuota!, valorPorAccion: v.valorPorAccion!,
    fechaEx: v.fechaEx!, fechaPago: v.fechaPago!, referencia: v.referencia!, anulada: v.anulada!, nota: v.nota ?? null,
  };
  return { ok: true, decreto };
}
