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
 * Los argumentos siguen las reglas de la vía B de los precios y del fondo (src/precios/argumentos-carga.ts y
 * src/fondo/argumentos-carga.ts, que este frente no toca: de ahí que la forma se repita aquí).
 */
import { ADELANTO_TRM_DIAS, CATALOGO, type SerieCatalogo } from "../catalogo";
import { escribirCsvSeries, type ValorSerie } from "../series/csv-series";
import { leerFechaIso } from "../../importacion/trii/valores";
import type { BuscarHttp } from "../../lib/http-acotado";
import { ErrorArgumentosCarga } from "../../precios/argumentos-carga";
import { escribirCompleto } from "../../precios/exportar";
import { diaIso, fechaEnBogota } from "../../precios/horario";
import { CODIGO_TRM, MAX_DIAS_RANGO_TRM, TIEMPO_MAXIMO_TRM_MS, obtenerTrm, trmDelCatalogo } from "./trm-sfc";

const DIA_MS = 86_400_000;
const FECHA = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
/** Solo se repite el nombre de una opción con esta forma: nunca una ruta, una fecha ni caracteres de control. */
const NOMBRE_REPETIBLE = /^--?[a-z][a-z0-9-]{0,30}$/;
const OPCIONES: readonly string[] = ["--desde", "--hasta"];

export const USO_EXPORTAR_TRM = [
  "Uso: npx tsx scripts/exportar-trm.ts --desde AAAA-MM-DD [--hasta AAAA-MM-DD] > <trm.csv.parcial>",
  "  Pide a la SFC (datos.gov.co, dataset 32sa-8pi3) las vigencias de la TRM que tocan el rango y escribe por stdout el CSV",
  "  de series (formato en src/datos-oficiales/series/csv-series.ts) que carga importar-series. La primera vigencia puede",
  "  empezar antes de --desde (un fin de semana).",
  `  --hasta por defecto y como máximo: hoy + ${ADELANTO_TRM_DIAS} día(s) (la SFC publica la TRM por adelantado); rango de hasta ${MAX_DIAS_RANGO_TRM} días.`,
  "  Se niega a escribir en una terminal. Por stderr solo conteos, códigos y fechas.",
  "  Salida: 0 bien · 3 filas descartadas o días sin vigencia (el CSV trae el resto) · 2 uso o terminal · 1 la SFC falló, sin filas o error.",
].join("\n");

type Entorno = Readonly<Record<string, string | undefined>>;

export interface ArgumentosExportarTrm {
  readonly desde: Date;
  readonly hasta: Date;
}

const variableDeNpm = (opcion: string): string => `npm_config_${opcion.slice(2)}`;

function desconocida(argumento: string): ErrorArgumentosCarga {
  const nombre = argumento.split("=", 1)[0] ?? "";
  return new ErrorArgumentosCarga(NOMBRE_REPETIBLE.test(nombre) ? `Opción desconocida: «${nombre}».` : "Opción desconocida.");
}

/** Las opciones con su valor; lanza ante cualquier forma no admitida. */
function leerOpciones(argv: readonly string[], entorno: Entorno): ReadonlyMap<string, string> {
  const tomada = OPCIONES.find((o) => entorno[variableDeNpm(o)] !== undefined && !argv.includes(o));
  if (tomada) throw new ErrorArgumentosCarga(`npm se quedó con ${tomada}: escriba «npm run -s <comando> -- ${tomada} …» (con «--»).`);
  const valores = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const opcion = argv[i]!;
    if (!opcion.startsWith("-")) throw new ErrorArgumentosCarga("Argumento suelto: no se admiten argumentos sueltos (cada valor va después de su opción).");
    if (!OPCIONES.includes(opcion)) throw desconocida(opcion);
    if (valores.has(opcion)) throw new ErrorArgumentosCarga(`${opcion} está repetida.`);
    const valor = argv[i + 1];
    if (valor === undefined || valor.startsWith("-")) throw new ErrorArgumentosCarga(`${opcion} necesita una fecha AAAA-MM-DD (no una opción ni algo que empiece por «-»).`);
    valores.set(opcion, valor);
  }
  return valores;
}

function fecha(texto: string | undefined, opcion: string): Date | undefined {
  if (texto === undefined) return undefined;
  const r = FECHA.test(texto) ? leerFechaIso(texto) : null;
  if (!r?.ok) throw new ErrorArgumentosCarga(`${opcion} debe ser una fecha AAAA-MM-DD válida.`);
  return r.valor;
}

/**
 * `hoy` es la fecha de negocio en Colombia; `adelantoDias`, el de la TRM en el catálogo. --hasta por defecto y como
 * máximo: hoy + el adelanto. Lanza ErrorArgumentosCarga ante cualquier otra forma; los mensajes no repiten fechas.
 */
export function leerArgumentosExportarTrm(argv: readonly string[], entorno: Entorno, hoy: Date, adelantoDias: number): ArgumentosExportarTrm {
  const valores = leerOpciones(argv, entorno);
  const desde = fecha(valores.get("--desde"), "--desde");
  if (desde === undefined) throw new ErrorArgumentosCarga("Falta --desde AAAA-MM-DD.");
  const tope = new Date(hoy.getTime() + adelantoDias * DIA_MS);
  const hasta = fecha(valores.get("--hasta"), "--hasta") ?? tope;
  if (desde > hasta || hasta > tope) throw new ErrorArgumentosCarga(`Rango inválido: --desde ≤ --hasta ≤ hoy + ${adelantoDias} día(s).`);
  if (hasta.getTime() - desde.getTime() > MAX_DIAS_RANGO_TRM * DIA_MS) throw new ErrorArgumentosCarga(`Rango inválido: más de ${MAX_DIAS_RANGO_TRM} días (pídalo por tramos).`);
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

export interface ResultadoExportacionTrm {
  readonly csv: string | null;
  /** Por qué no hay CSV (de la fuente, del catálogo o del CSV), o null. */
  readonly codigo: string | null;
  readonly filas: number;
  readonly descartadas: number;
  /**
   * Días del rango, hasta hoy, que ninguna vigencia del CSV cubre (al inicio, entre vigencias o al final; un valor
   * descartado deja el suyo). La vigencia de mañana sin publicar no cuenta.
   */
  readonly diasSinVigencia: number;
  readonly primerDiaSinVigencia: Date | null;
  readonly primeraDesde: Date | null;
  readonly ultimaHasta: Date | null;
}

const sinCsv = (codigo: string, descartadas: number): ResultadoExportacionTrm => ({
  csv: null, codigo, filas: 0, descartadas, diasSinVigencia: 0, primerDiaSinVigencia: null, primeraDesde: null, ultimaHasta: null,
});

/**
 * Los días de [desde, fin] que ninguna vigencia cubre: al inicio, entre vigencias y al final (las vigencias vienen
 * ordenadas y sin solapes). `fin` es el último día que ya debía estar publicado: min(--hasta, hoy). La vigencia de
 * mañana (la SFC la publica por adelantado, en la tarde) puede no estar aún: no es un hueco.
 */
function diasSinVigencia(valores: readonly ValorSerie[], desde: Date, fin: Date): { readonly dias: number; readonly primero: Date | null } {
  let dias = 0;
  let primero: Date | null = null;
  /** El primer día aún no cubierto. */
  let cursor = desde.getTime();
  const contarHasta = (ultimoMs: number): void => {
    const faltan = (ultimoMs - cursor) / DIA_MS + 1;
    if (faltan <= 0) return;
    dias += faltan;
    primero ??= new Date(cursor);
  };
  for (const v of valores) {
    contarHasta(Math.min(v.desde.getTime() - DIA_MS, fin.getTime()));
    // parsearTrm las entrega ordenadas, sin solapes y tocando el rango: cada `hasta` pasa el cursor.
    cursor = v.hasta.getTime() + DIA_MS;
  }
  contarHasta(fin.getTime());
  return { dias, primero };
}

export async function exportarTrm(o: OpcionesExportacionTrm): Promise<ResultadoExportacionTrm> {
  const catalogo = o.catalogo ?? CATALOGO;
  const trm = trmDelCatalogo(catalogo);
  if (!trm) return sinCsv("TRM_CATALOGO", 0);
  const r = await obtenerTrm({ desde: o.desde, hasta: o.hasta }, o.buscar, trm);
  if (!r.ok) return sinCsv(r.codigo, 0);
  const escrito = escribirCsvSeries([{ codigo: CODIGO_TRM, valores: r.valores }], o.hoy, catalogo);
  if (!escrito.ok) return sinCsv(escrito.codigo, r.descartadas);
  const huecos = diasSinVigencia(r.valores, o.desde, o.hasta < o.hoy ? o.hasta : o.hoy);
  return {
    csv: escrito.texto,
    codigo: null,
    filas: escrito.filas,
    descartadas: r.descartadas,
    diasSinVigencia: huecos.dias,
    primerDiaSinVigencia: huecos.primero,
    primeraDesde: r.valores[0]?.desde ?? null,
    ultimaHasta: r.valores.at(-1)?.hasta ?? null,
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
    `⚠️  TRM · ${r.descartadas} fila(s) descartada(s) (TRM_VALOR_INVALIDO): valor ausente o fuera de la escala o el rango del catálogo${r.csv === null ? "" : "; el CSV trae el resto"}.`,
  ];
  if (r.csv === null || r.codigo !== null) return { lineas: [...descartes, lineaFallo(r.codigo ?? "SIN_FILAS")], codigoSalida: 1 };
  const rango = r.primeraDesde && r.ultimaHasta ? `desde ${diaIso(r.primeraDesde)} hasta ${diaIso(r.ultimaHasta)}` : "sin vigencias";
  const huecos = r.diasSinVigencia === 0 ? [] : [
    `⚠️  TRM · ${r.diasSinVigencia} día(s) del rango sin vigencia (el primero: ${r.primerDiaSinVigencia ? diaIso(r.primerDiaSinVigencia) : "?"}): revíselo antes de importar.`,
  ];
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
  if (r.csv !== null && !(await escribirCsv(e.salida, r.csv))) {
    e.error("❌ SALIDA_CERRADA · no se pudo escribir el CSV completo (¿se cerró el tubo o se llenó el disco?): no lo use.");
    return 1;
  }
  const reporte = reporteExportacionTrm(r);
  for (const linea of reporte.lineas) e.error(linea);
  return reporte.codigoSalida;
}
