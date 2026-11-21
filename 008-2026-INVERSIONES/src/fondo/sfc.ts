/**
 * Valor de unidad diario de un FIC desde la Superintendencia Financiera (datos.gov.co, dataset
 * `qhpu-8ixx`, API Socrata). Fuente oficial y gratuita (INVESTIGACION-FUENTES-DATOS de 008).
 * - Un mismo `codigo_negocio` trae una fila por día y por clase (`tipo_participacion`), con valores de
 *   unidad distintos: sin clase y con varias clases no se adivina (SFC_VARIAS_PARTICIPACIONES).
 * - Estructura rara (no es arreglo, código ajeno, fecha inválida o fuera del rango): se rechaza toda la
 *   respuesta. Un valor de unidad inválido de la clase propia se descarta y se cuenta.
 * - El retraso normal es de 1 a 2 días hábiles: una respuesta vacía no es error.
 * - Nunca lanza: los fallos vuelven como código.
 */
import { Prisma } from "@prisma/client";
import { leerFechaIso } from "../importacion/trii/valores";

export const FUENTE_SFC = "sfc:qhpu-8ixx";
const URL_SFC = "https://www.datos.gov.co/resource/qhpu-8ixx.json";
/** Tope de filas por consulta: llegar a él indica una respuesta truncada (hay que partir el rango). */
export const LIMITE_FILAS = 5000;
/** Topes de cordura en COP: por encima, el dato se considera corrupto. Caben en Decimal(20,8) y Decimal(24,4). */
export const VALOR_UNIDAD_MAXIMO_COP = new Prisma.Decimal("10000000");
export const VALOR_FONDO_MAXIMO_COP = new Prisma.Decimal("10000000000000000");
const ESCALA_VALOR_UNIDAD = 8;
const ESCALA_VALOR_FONDO = 4;
const TIEMPO_MAXIMO_MS = 10_000;
/** Tope del cuerpo de la respuesta: 5000 filas de 5 campos ocupan cerca de 1 MB. */
export const BYTES_MAXIMOS = 2 * 1024 * 1024;
export const CODIGO_FIC_RE = /^\d{1,12}$/;
export const PARTICIPACION_RE = /^\d{1,6}$/;
const CAMPOS = ["fecha_corte", "codigo_negocio", "tipo_participacion", "valor_unidad_operaciones", "valor_fondo_cierre_dia_t"] as const;

export interface ConsultaSfc {
  readonly codigo: string; // codigo_negocio
  readonly participacion: string | null; // tipo_participacion (clase); null = sin filtrar
  readonly desde: Date;
  readonly hasta: Date;
}

export interface ValorDia {
  readonly fecha: Date; // fecha de corte, a medianoche UTC
  readonly valorUnidad: string; // texto decimal canónico, hasta 8 decimales
  readonly valorFondo: string | null; // informativo, hasta 4 decimales
}

export type ResultadoSfc = { ok: true; valores: ValorDia[]; descartados: number } | { ok: false; codigo: string };

type FilaSfc = Readonly<Record<string, unknown>>;

/** Lo que se usa de la respuesta de `fetch`: estado, encabezados y el cuerpo como flujo (para ponerle tope). */
export interface RespuestaSfc {
  readonly ok: boolean;
  readonly status: number;
  readonly headers: { get(nombre: string): string | null };
  readonly body: ReadableStream<Uint8Array> | null;
}

/** `fetch` inyectable: en las pruebas nunca hay red real. */
export type BuscarSfc = (url: string, init: { headers: Record<string, string>; signal: AbortSignal; redirect: "error" }) => Promise<RespuestaSfc>;

/** Fecha de negocio (medianoche UTC) como AAAA-MM-DD. */
export const isoDia = (d: Date): string => d.toISOString().slice(0, 10);

/** «2024-03-12T00:00:00.000» (timestamp flotante de Socrata) → fecha de negocio. Nunca pasa por la zona del proceso. */
export function leerFechaCorte(valor: unknown): Date | null {
  if (typeof valor !== "string") return null;
  const m = /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?$/.exec(valor);
  if (!m) return null;
  const fecha = leerFechaIso(m[1]!);
  return fecha.ok ? fecha.valor : null;
}

/** Decimal positivo sin signo, exponente ni coma, redondeado a la escala y con tope; null si no sirve. */
function leerDecimalSfc(valor: unknown, escala: number, maximo: Prisma.Decimal): string | null {
  const texto = typeof valor === "number" && Number.isFinite(valor) ? String(valor) : valor;
  if (typeof texto !== "string" || !/^\d{1,30}(?:\.\d{1,30})?$/.test(texto)) return null;
  const d = new Prisma.Decimal(texto).toDecimalPlaces(escala, Prisma.Decimal.ROUND_HALF_UP);
  return d.gt(0) && d.lte(maximo) ? d.toFixed() : null;
}

export function leerValorUnidad(valor: unknown): string | null {
  return leerDecimalSfc(valor, ESCALA_VALOR_UNIDAD, VALOR_UNIDAD_MAXIMO_COP);
}

/** Informativo: si no sirve, null (nunca descarta el valor de unidad). */
export function leerValorFondo(valor: unknown): string | null {
  return leerDecimalSfc(valor, ESCALA_VALOR_FONDO, VALOR_FONDO_MAXIMO_COP);
}

/** Estructura de cada fila: objeto, del código pedido y con fecha válida dentro del rango. */
function estructuraValida(cuerpo: readonly unknown[], consulta: ConsultaSfc): cuerpo is readonly FilaSfc[] {
  return cuerpo.every((f) => {
    if (typeof f !== "object" || f === null || Array.isArray(f)) return false;
    const fila = f as FilaSfc;
    const fecha = leerFechaCorte(fila.fecha_corte);
    return fila.codigo_negocio === consulta.codigo && fecha !== null && fecha >= consulta.desde && fecha <= consulta.hasta;
  });
}

/** Agrupa por día: filas idénticas se funden; dos valores distintos el mismo día son ambiguos. */
function agruparPorDia(filas: readonly FilaSfc[]): ResultadoSfc {
  const porDia = new Map<number, ValorDia>();
  let descartados = 0;
  for (const fila of filas) {
    const valorUnidad = leerValorUnidad(fila.valor_unidad_operaciones);
    if (valorUnidad === null) {
      descartados += 1;
      continue;
    }
    const fecha = leerFechaCorte(fila.fecha_corte)!;
    const valor: ValorDia = { fecha, valorUnidad, valorFondo: leerValorFondo(fila.valor_fondo_cierre_dia_t) };
    const previo = porDia.get(fecha.getTime());
    if (previo && (previo.valorUnidad !== valor.valorUnidad || previo.valorFondo !== valor.valorFondo)) return { ok: false, codigo: "SFC_AMBIGUO" };
    porDia.set(fecha.getTime(), valor);
  }
  const valores = [...porDia.values()].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  return { ok: true, valores, descartados };
}

/** Puro: convierte la respuesta de Socrata en valores por día. Orden: estructura → clase → valores. */
export function parsearSfc(cuerpo: unknown, consulta: ConsultaSfc): ResultadoSfc {
  if (!Array.isArray(cuerpo)) return { ok: false, codigo: "SFC_FORMATO" };
  if (cuerpo.length >= LIMITE_FILAS) return { ok: false, codigo: "SFC_TRUNCADO" };
  if (!estructuraValida(cuerpo, consulta)) return { ok: false, codigo: "SFC_FORMATO" };
  const propias = consulta.participacion === null ? cuerpo : cuerpo.filter((f) => f.tipo_participacion === consulta.participacion);
  if (consulta.participacion === null && new Set(propias.map((f) => f.tipo_participacion)).size > 1) {
    return { ok: false, codigo: "SFC_VARIAS_PARTICIPACIONES" };
  }
  return agruparPorDia(propias);
}

/** URL de la consulta. El código y la clase ya vienen validados; las fechas las arma el sistema. */
function urlConsulta(consulta: ConsultaSfc): string {
  const parametros = new URLSearchParams({ codigo_negocio: consulta.codigo });
  if (consulta.participacion !== null) parametros.set("tipo_participacion", consulta.participacion);
  parametros.set("$select", CAMPOS.join(","));
  parametros.set("$where", `fecha_corte >= '${isoDia(consulta.desde)}T00:00:00' AND fecha_corte <= '${isoDia(consulta.hasta)}T00:00:00'`);
  parametros.set("$order", "fecha_corte ASC");
  parametros.set("$limit", String(LIMITE_FILAS));
  return `${URL_SFC}?${parametros.toString()}`;
}

function consultaInvalida(consulta: ConsultaSfc): string | null {
  if (!CODIGO_FIC_RE.test(consulta.codigo)) return "CODIGO_FIC_INVALIDO";
  if (consulta.participacion !== null && !PARTICIPACION_RE.test(consulta.participacion)) return "PARTICIPACION_INVALIDA";
  if (consulta.desde > consulta.hasta) return "RANGO_INVALIDO";
  return null;
}

type Cuerpo = { ok: true; texto: string } | { ok: false; codigo: string };

/** Lee el cuerpo con tope de bytes: rechaza por el content-length declarado y corta el flujo si lo pasa. */
async function leerCuerpo(respuesta: RespuestaSfc): Promise<Cuerpo> {
  const declarado = Number(respuesta.headers.get("content-length"));
  if (declarado > BYTES_MAXIMOS || !respuesta.body) return { ok: false, codigo: "SFC_FORMATO" };
  const lector = respuesta.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    for (let parte = await lector.read(); !parte.done; parte = await lector.read()) {
      total += parte.value.byteLength;
      if (total > BYTES_MAXIMOS) {
        await lector.cancel().catch(() => undefined);
        return { ok: false, codigo: "SFC_FORMATO" };
      }
      partes.push(parte.value);
    }
  } catch {
    return { ok: false, codigo: "SFC_RED" };
  }
  try {
    return { ok: true, texto: new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(partes)) };
  } catch {
    return { ok: false, codigo: "SFC_FORMATO" };
  }
}

/** Pide los valores de unidad del fondo entre dos fechas (incluidas). No lanza. */
export async function obtenerValores(consulta: ConsultaSfc, buscar: BuscarSfc): Promise<ResultadoSfc> {
  const invalida = consultaInvalida(consulta);
  if (invalida) return { ok: false, codigo: invalida };
  let respuesta: RespuestaSfc;
  try {
    respuesta = await buscar(urlConsulta(consulta), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS), redirect: "error" });
  } catch {
    return { ok: false, codigo: "SFC_RED" };
  }
  if (!respuesta.ok) return { ok: false, codigo: `SFC_HTTP_${respuesta.status}` };
  const cuerpo = await leerCuerpo(respuesta);
  if (!cuerpo.ok) return cuerpo;
  let datos: unknown;
  try {
    datos = JSON.parse(cuerpo.texto);
  } catch {
    return { ok: false, codigo: "SFC_FORMATO" };
  }
  return parsearSfc(datos, consulta);
}
