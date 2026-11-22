/**
 * `exportar-trm` (fase C · C2b, vía B de las series): en el Mac, que sí tiene red, pide a la SFC (datos.gov.co,
 * 32sa-8pi3) las vigencias de la TRM de un rango y escribe por stdout el CSV canónico de series
 * (series/csv-series.ts) que `importar-series` carga en producción (sin red). Sin base de datos.
 *   npx tsx scripts/exportar-trm.ts --desde AAAA-MM-DD [--hasta AAAA-MM-DD] > <trm.csv.parcial> && mv …
 * - La TRM es pública y la consulta no lleva nada del portafolio: a diferencia de fondo:exportar y precios:exportar, no
 *   se exige una salida privada (umask). Sí se niega a escribir en una terminal: el CSV va a un archivo.
 * - El CSV se entrega entero al final (`escribirCompleto`), con la fuente del catálogo, y antes se vuelve a leer con el
 *   lector del importador (`escribirCsvSeries`): nunca uno a medias ni uno que el importador rechazaría.
 * - Por stderr solo conteos, códigos y fechas ya validadas; nunca valores ni texto de la fuente.
 * Salida: 0 bien · 3 filas descartadas o días sin vigencia (el CSV trae el resto) · 2 uso o terminal · 1 la SFC falló,
 * sin filas, catálogo o CSV inválido, o la salida se cerró.
 *
 * Los argumentos siguen las reglas de la vía B de los precios y del fondo: el lector común de src/cli/opciones.ts. Lo
 * propio: «Falta --desde AAAA-MM-DD.» (sin «<>») y el tope de --hasta, hoy + el adelanto de la TRM.
 */
import { ADELANTO_TRM_DIAS, CATALOGO, type SerieCatalogo } from "../catalogo";
import { escribirCsvSeries, type ValorSerie } from "../series/csv-series";
import { ErrorArgumentosCarga, exigirRango, fechaDeOpcion, leerOpciones, type Entorno } from "../../cli/opciones";
import type { BuscarHttp } from "../../lib/http-acotado";
import { escribirCompleto } from "../../precios/exportar";
import { diaIso, fechaEnBogota } from "../../precios/horario";
import { CODIGO_TRM, MAX_DIAS_RANGO_TRM, TIEMPO_MAXIMO_TRM_MS, obtenerTrm, trmDelCatalogo } from "./trm-sfc";

const DIA_MS = 86_400_000;
const OPCIONES = { "--desde": "una fecha AAAA-MM-DD", "--hasta": "una fecha AAAA-MM-DD" } as const;

export const USO_EXPORTAR_TRM = [
  "Uso: npx tsx scripts/exportar-trm.ts --desde AAAA-MM-DD [--hasta AAAA-MM-DD] > <trm.csv.parcial>",
  "  Pide a la SFC (datos.gov.co, dataset 32sa-8pi3) las vigencias de la TRM que tocan el rango y escribe por stdout el CSV",
  "  de series (formato en src/datos-oficiales/series/csv-series.ts) que carga importar-series. La primera vigencia puede",
  "  empezar antes de --desde (un fin de semana).",
  `  --hasta por defecto y como máximo: hoy + ${ADELANTO_TRM_DIAS} día(s) (la SFC publica la TRM por adelantado); rango de hasta ${MAX_DIAS_RANGO_TRM} días.`,
  "  Se niega a escribir en una terminal. Por stderr solo conteos, códigos y fechas.",
  "  Salida: 0 bien · 3 filas descartadas o días sin vigencia (el CSV trae el resto) · 2 uso o terminal · 1 la SFC falló, sin filas o error.",
].join("\n");

export interface ArgumentosExportarTrm {
  readonly desde: Date;
  readonly hasta: Date;
}

/**
 * `hoy` es la fecha de negocio en Colombia; `adelantoDias`, el de la TRM en el catálogo. --hasta por defecto y como
 * máximo: hoy + el adelanto. Lanza ErrorArgumentosCarga ante cualquier otra forma; los mensajes no repiten fechas.
 */
export function leerArgumentosExportarTrm(argv: readonly string[], entorno: Entorno, hoy: Date, adelantoDias: number): ArgumentosExportarTrm {
  const valores = leerOpciones(argv, OPCIONES, entorno);
  const desde = fechaDeOpcion(valores.get("--desde"), "--desde");
  if (desde === undefined) throw new ErrorArgumentosCarga("Falta --desde AAAA-MM-DD.");
  const tope = new Date(hoy.getTime() + adelantoDias * DIA_MS);
  const hasta = fechaDeOpcion(valores.get("--hasta"), "--hasta") ?? tope;
  exigirRango(desde, hasta, tope, MAX_DIAS_RANGO_TRM, `hoy + ${adelantoDias} día(s)`);
  return { desde, hasta };
}

export interface OpcionesExportacionTrm {
  readonly desde: Date;
  readonly hasta: Date;
  /** Fecha de negocio en Colombia: el tope del adelanto al volver a leer el CSV. */
  readonly hoy: Date;
  readonly buscar: BuscarHttp;
  /** El de 008; se inyecta solo en las pruebas. */
  readonly catalogo?: readonly SerieCatalogo[];
}

/** Días del rango que ninguna vigencia del CSV cubre, y el primero de ellos. */
export interface DiasSinVigencia {
  readonly dias: number;
  readonly primero: Date;
}

/** Hay CSV (al menos una vigencia). */
export interface ExportacionTrm {
  readonly ok: true;
  readonly csv: string;
  readonly filas: number;
  readonly descartadas: number;
  readonly primeraDesde: Date;
  readonly ultimaHasta: Date;
  /**
   * Los días del rango, hasta hoy, sin vigencia (al inicio, entre vigencias o al final; un valor descartado deja el
   * suyo), o null si no falta ninguno. La vigencia de mañana sin publicar no cuenta.
   */
  readonly sinVigencia: DiasSinVigencia | null;
}

/** No hay CSV: el código (de la fuente, del catálogo o del CSV) y cuántas filas se descartaron. */
export interface ExportacionTrmFallida {
  readonly ok: false;
  readonly codigo: string;
  readonly descartadas: number;
}

export type ResultadoExportacionTrm = ExportacionTrm | ExportacionTrmFallida;

const fallida = (codigo: string, descartadas: number): ExportacionTrmFallida => ({ ok: false, codigo, descartadas });

/**
 * Los días de [desde, fin] que ninguna vigencia cubre: al inicio, entre vigencias y al final (las vigencias vienen
 * ordenadas y sin solapes). `fin` es el último día que ya debía estar publicado: min(--hasta, hoy). La vigencia de
 * mañana (la SFC la publica por adelantado, en la tarde) puede no estar aún: no es un hueco.
 */
function diasSinVigencia(valores: readonly ValorSerie[], desde: Date, fin: Date): DiasSinVigencia | null {
  const finMs = fin.getTime();
  // Un tramo centinela justo después de `fin` cuenta los días que faltan al final con la misma cuenta.
  const tramos = [...valores.map((v) => ({ desde: v.desde.getTime(), hasta: v.hasta.getTime() })), { desde: finMs + DIA_MS, hasta: finMs + DIA_MS }];
  let dias = 0;
  let primero: number | null = null;
  /** El primer día aún no cubierto. */
  let cursor = desde.getTime();
  for (const t of tramos) {
    const faltan = (Math.min(t.desde - DIA_MS, finMs) - cursor) / DIA_MS + 1;
    if (faltan > 0) {
      dias += faltan;
      primero ??= cursor;
    }
    // parsearTrm las entrega ordenadas, sin solapes y tocando el rango: cada `hasta` pasa el cursor.
    cursor = t.hasta + DIA_MS;
  }
  return primero === null ? null : { dias, primero: new Date(primero) };
}

export async function exportarTrm(o: OpcionesExportacionTrm): Promise<ResultadoExportacionTrm> {
  const catalogo = o.catalogo ?? CATALOGO;
  const trm = trmDelCatalogo(catalogo);
  if (!trm) return fallida("TRM_CATALOGO", 0);
  const r = await obtenerTrm({ desde: o.desde, hasta: o.hasta }, o.buscar, trm);
  if (!r.ok) return fallida(r.codigo, 0);
  const [primera] = r.valores;
  if (primera === undefined) return fallida("SIN_FILAS", r.descartadas);
  const escrito = escribirCsvSeries([{ codigo: CODIGO_TRM, valores: r.valores }], o.hoy, catalogo);
  if (!escrito.ok) return fallida(escrito.codigo, r.descartadas);
  return {
    ok: true,
    csv: escrito.texto,
    filas: escrito.filas,
    descartadas: r.descartadas,
    primeraDesde: primera.desde,
    // Hay al menos una (la primera): la última existe.
    ultimaHasta: r.valores[r.valores.length - 1]!.hasta,
    sinVigencia: diasSinVigencia(r.valores, o.desde, o.hasta < o.hoy ? o.hasta : o.hoy),
  };
}

const AVISE = "avise al CEO de 008 (la fuente o el catálogo cambiaron)";
const INDICACION: ReadonlyMap<string, string> = new Map([
  ["TRM_RED", `no se pudo consultar la SFC (red o plazo de ${TIEMPO_MAXIMO_TRM_MS / 1000} s): repita más tarde`],
  ["TRM_TIPO", "la SFC no respondió JSON (¿una página de error o de mantenimiento?): repita más tarde"],
  ["TRM_FORMATO", "respuesta rara o demasiado grande: pida un rango más corto o repita más tarde"],
  ["TRM_TRUNCADO", "la respuesta llegó al límite de filas: pida un rango más corto"],
  ["TRM_UNIDAD", `una vigencia no viene en COP: ${AVISE}`],
  ["TRM_VIGENCIA", `una vigencia pasa de los días que admite el catálogo: ${AVISE}`],
  ["TRM_SOLAPE", `dos vigencias de la fuente se solapan: ${AVISE}`],
  ["TRM_CATALOGO", "el catálogo no trae la TRM como TRAMO con la fuente sfc:32sa-8pi3: avise al CEO de 008"],
  ["TRM_RANGO_INVALIDO", "el rango pedido está al revés"],
  ["SIN_FILAS", "la SFC no trajo vigencias en el rango (o todas se descartaron)"],
  ["FILA_INVALIDA", "una vigencia no pasaría la validación del importador (¿empieza después de mañana?)"],
  ["CSV_DEMASIADO_GRANDE", "pida un rango más corto"],
]);
const INDICACION_HTTP = "la SFC respondió con error HTTP: repita más tarde";

/** La última línea de un fallo: el código y qué hacer. */
const lineaFallo = (codigo: string): string =>
  `❌ ${codigo} · ${INDICACION.get(codigo) ?? (codigo.startsWith("TRM_HTTP_") ? INDICACION_HTTP : "fallo de la fuente")}; no se escribió el CSV.`;

export interface ReporteTrm {
  readonly lineas: readonly string[];
  readonly codigoSalida: 0 | 1 | 3;
}

/** El reporte a stderr (el CSV va a stdout): conteos, códigos y fechas. 1 sin CSV; 3 con descartes o días sin vigencia. */
export function reporteExportacionTrm(r: ResultadoExportacionTrm): ReporteTrm {
  const descartes = r.descartadas === 0 ? [] : [
    `⚠️  TRM · ${r.descartadas} fila(s) descartada(s) (TRM_VALOR_INVALIDO): valor ausente o fuera de la escala o el rango del catálogo${r.ok ? "; el CSV trae el resto" : ""}.`,
  ];
  if (!r.ok) return { lineas: [...descartes, lineaFallo(r.codigo)], codigoSalida: 1 };
  const huecos = r.sinVigencia === null ? [] : [
    `⚠️  TRM · ${r.sinVigencia.dias} día(s) del rango sin vigencia (el primero: ${diaIso(r.sinVigencia.primero)}): revíselo antes de importar.`,
  ];
  const rango = `desde ${diaIso(r.primeraDesde)} hasta ${diaIso(r.ultimaHasta)}`;
  const lineas = [`✅ TRM · SFC (datos.gov.co, 32sa-8pi3) · filas en el CSV: ${r.filas} · ${rango} · descartadas: ${r.descartadas}`, ...descartes, ...huecos];
  return { lineas, codigoSalida: descartes.length + huecos.length > 0 ? 3 : 0 };
}

export interface EntornoExportarTrm {
  readonly argv: readonly string[];
  /** process.env (para la trampa de npm). */
  readonly entorno: Entorno;
  readonly ahora: Date;
  readonly buscar: BuscarHttp;
  /** process.stdout.isTTY: con una terminal no se escribe nada ni se sale a la red. */
  readonly esTerminal: boolean;
  readonly salida: NodeJS.WritableStream;
  /** Una línea a stderr. */
  readonly error: (linea: string) => void;
  /** El de 008; se inyecta solo en las pruebas. */
  readonly catalogo?: readonly SerieCatalogo[];
}

/**
 * Escribe el CSV entero; false si la salida falló (EPIPE: el lector cerró el tubo). El oyente de «error» queda puesto a
 * propósito: el stream puede emitir el mismo error después de la llamada de vuelta y, sin oyente, tumbaría el proceso
 * con una traza en vez del código SALIDA_CERRADA, que ya se informa por el valor devuelto.
 */
async function escribirCsv(salida: NodeJS.WritableStream, texto: string): Promise<boolean> {
  let fallo = false;
  salida.on("error", () => {
    fallo = true;
  });
  try {
    await escribirCompleto(salida, texto);
  } catch {
    fallo = true;
  }
  return !fallo;
}

/**
 * El CLI entero (scripts/exportar-trm.ts solo cablea el proceso): devuelve el código de salida. `hoy` se calcula una
 * vez. Orden: catálogo (el tope de --hasta sale del adelanto de la TRM) → argumentos → terminal → red.
 */
export async function correrExportarTrm(e: EntornoExportarTrm): Promise<0 | 1 | 2 | 3> {
  const hoy = fechaEnBogota(e.ahora);
  const catalogo = e.catalogo ?? CATALOGO;
  const trm = trmDelCatalogo(catalogo);
  if (!trm) {
    e.error(lineaFallo("TRM_CATALOGO"));
    return 1;
  }
  let a: ArgumentosExportarTrm;
  try {
    a = leerArgumentosExportarTrm(e.argv, e.entorno, hoy, trm.serie.adelantoMaximoDias);
  } catch (error) {
    if (!(error instanceof ErrorArgumentosCarga)) throw error;
    e.error(`❌ ${error.message}`);
    e.error(USO_EXPORTAR_TRM);
    return 2;
  }
  if (e.esTerminal) {
    e.error("❌ SALIDA_TERMINAL · el CSV va a un archivo (> …), nunca a la pantalla; no se pidió nada a la SFC.");
    return 2;
  }
  const r = await exportarTrm({ desde: a.desde, hasta: a.hasta, hoy, buscar: e.buscar, catalogo });
  if (r.ok && !(await escribirCsv(e.salida, r.csv))) {
    e.error("❌ SALIDA_CERRADA · no se pudo escribir el CSV completo (¿se cerró el tubo o se llenó el disco?): no lo use.");
    return 1;
  }
  const reporte = reporteExportacionTrm(r);
  for (const linea of reporte.lineas) e.error(linea);
  return reporte.codigoSalida;
}
