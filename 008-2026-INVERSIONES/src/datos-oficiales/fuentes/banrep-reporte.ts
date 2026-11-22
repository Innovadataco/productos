/**
 * El reporte de scripts/exportar-banrep.ts, por stderr (el CSV va a stdout): conteos, códigos, las fechas del pedido y de
 * la serie (públicas) y la URL pública de la descarga. Nunca valores ni rutas. Ante un fallo de BanRep dice qué hacer:
 * abrir la URL en el navegador, resolver usted el desafío si lo hay y repetir con --archivo. Nada se evade.
 * Salida: 1 si no hay CSV (fallo de BanRep o del archivo, sin filas o fila inválida) · 3 si hay avisos (descartes, inicio
 * tardío, serie atrasada o días faltantes; el CSV sale entero, pero `&& mv` no lo mueve: se dice) · 0 si no. El 1 gana
 * sobre el 3.
 */
import { diaIso } from "../../precios/horario";
import { SALIDA_CON_AVISOS, SALIDA_FALLIDA } from "../../precios/reporte";
import type { ResultadoExportarBanrep } from "./banrep-exportar";
import type { CodigoBanrep } from "./banrep-series";

/** Uso, terminal o un --archivo que no se puede abrir. */
export const SALIDA_USO = 2;

export interface ReporteBanrep {
  readonly lineas: readonly string[];
  readonly codigoSalida: 0 | typeof SALIDA_FALLIDA | typeof SALIDA_USO | typeof SALIDA_CON_AVISOS;
}

type CodigoArchivo = "ARCHIVO_ILEGIBLE" | "ARCHIVO_NO_REGULAR" | "ARCHIVO_DEMASIADO_GRANDE";

const GUARDAR = "guárdelo como XML (la fuente de la página, no un «archivo web»)";
const ACOTAR = "pida la descarga con un startPeriod más reciente (un --desde más reciente)";
const PARCIAL_SIN_MOVER = "   Con avisos (salida 3) el CSV salió entero, pero «&& mv» no lo movió: revise los avisos y, si los acepta, muévalo usted.";

const EXPLICACION: Readonly<Record<string, string>> = {
  BANREP_BLOQUEADO: "BanRep no entregó el SDMX: respondió una página HTML (captcha, bloqueo o error) o negó el pedido (403 o 429)",
  BANREP_TIPO: "BanRep respondió un tipo de contenido que no es el XML del SDMX ni una página HTML, o un charset distinto de UTF-8",
  BANREP_RED: "no hubo respuesta a tiempo, falló la red o BanRep redirigió (un desafío antibots redirige)",
  BANREP_FORMATO: `la respuesta vino vacía o pasa del tope de bytes del lector: ${ACOTAR}`,
  BANREP_XML: "el lector XML acotado lo rechazó (DTD, entidades, CDATA, codificación, topes o XML mal formado)",
  BANREP_ERROR_SDMX: "BanRep respondió un mensaje de error SDMX (p. ej. sin datos para ese periodo)",
  BANREP_NO_SDMX: "no es el mensaje SDMX genérico de datos de BanRep que se espera (raíz, cabecera o estructura distintas)",
  BANREP_OTRO_DATAFLOW: "el XML es de otro dataflow (¿el archivo de la otra serie?)",
  BANREP_TRUNCADO: "el mensaje trae un pie (Footer): BanRep avisa que la respuesta está incompleta",
  BANREP_SERIE_AUSENTE: "el XML no trae la serie pedida (SUBJECT y UNIT_MEASURE del catálogo)",
  BANREP_SERIE_REPETIDA: "el XML trae dos series con la clave pedida",
  BANREP_SERIE_DISTINTA: "la serie no es diaria, de Colombia o trae un multiplicador (UNIT_MULT distinto de 0)",
  BANREP_UNIDAD_DUDOSA: "un día la efectiva anual quedó por debajo de la nominal: las unidades parecen cruzadas",
  BANREP_OBS_INVALIDA: "una observación no tiene la forma esperada (fecha AAAAMMDD, valor o estado)",
  BANREP_AMBIGUO: "el XML trae el mismo día dos veces con valores o estados distintos",
  BANREP_ERROR_INTERNO: "el lector falló de una forma no prevista",
};
const SIN_CSV: Readonly<Record<NonNullable<ResultadoExportarBanrep["codigoCsv"]>, string>> = {
  SIN_FILAS: "no hay valores de la serie en el rango pedido",
  CSV_DEMASIADO_GRANDE: "pida un rango más corto",
  FILA_INVALIDA: "una fila no pasaría la validación del importador",
};

const explicacion = (codigo: CodigoBanrep): string => EXPLICACION[codigo] ?? "BanRep respondió con un estado HTTP de error (caída o bloqueo: no se adivina)";

/** Qué hacer ante un fallo: con la red, bajar el XML en el navegador; con --archivo, volver a guardarlo. */
function indicacion(r: ResultadoExportarBanrep): string[] {
  if (r.origen === "ARCHIVO") return [`   Vuelva a bajarlo en su navegador (${r.url}), ${GUARDAR}, y repita con --archivo.`];
  return [
    `   Abra en su navegador ${r.url} (si hay un desafío, lo resuelve usted), ${GUARDAR} en su carpeta privada y repita con --archivo <ruta>.`,
    "   Nada se evade: este comando no reintenta, no imita un navegador ni guarda cookies.",
  ];
}

function avisos(r: ResultadoExportarBanrep): string[] {
  const c = r.conteos;
  const descartes = c && c.noDefinitivas + c.sinValor + c.valorInvalido > 0
    ? [`⚠️  descartadas · no definitivas (OBS_STATUS distinto de A): ${c.noDefinitivas} · sin valor: ${c.sinValor} · valor fuera de la escala o del rango del catálogo: ${c.valorInvalido}`]
    : [];
  const tardio = r.inicioTardio && r.primerDia
    ? [`⚠️  INICIO_TARDIO · el primer valor es del ${diaIso(r.primerDia)}: más de ${r.umbralFrescuraDias} días después de --desde (${diaIso(r.desde)}). ¿El --archivo se bajó con un startPeriod posterior, o BanRep no tiene esos días?`]
    : [];
  const atrasada = r.atrasada && r.ultimoDia
    ? [`⚠️  ATRASADA · el último valor es del ${diaIso(r.ultimoDia)}: más de ${r.umbralFrescuraDias} días antes de --hasta (${diaIso(r.hasta)}). BanRep puede no haber publicado todavía.`]
    : [];
  const faltantes = r.diasFaltantes > 0 ? [`⚠️  faltan ${r.diasFaltantes} día(s) entre el primero y el último: la ${r.serie} es diaria de calendario.`] : [];
  return [...descartes, ...tardio, ...atrasada, ...faltantes];
}

export function reporteExportacionBanrep(r: ResultadoExportarBanrep): ReporteBanrep {
  if (r.fallo) {
    const detalle = r.fallo.detalle === null ? "" : ` (${r.fallo.detalle})`;
    return { lineas: [`❌ ${r.fallo.codigo}${detalle} · ${explicacion(r.fallo.codigo)}.`, ...indicacion(r)], codigoSalida: SALIDA_FALLIDA };
  }
  const c = r.conteos;
  const origen = r.origen === "RED" ? "BanRep (red)" : "archivo";
  const tramo = r.primerDia && r.ultimoDia ? ` · del ${diaIso(r.primerDia)} al ${diaIso(r.ultimoDia)}` : "";
  const resumen = `✅ ${r.serie} · ${origen} · observaciones de la serie en el XML: ${c?.observaciones ?? 0} · filas en el CSV: ${r.filas}${tramo} · fuera del rango pedido: ${c?.fueraDelRango ?? 0}`;
  const lista = avisos(r);
  const sinCsv = r.codigoCsv === null ? [] : [`❌ ${r.codigoCsv} · no se escribió el CSV (${SIN_CSV[r.codigoCsv]}).`];
  const codigoSalida = sinCsv.length > 0 ? SALIDA_FALLIDA : lista.length > 0 ? SALIDA_CON_AVISOS : 0;
  const parcial = codigoSalida === SALIDA_CON_AVISOS ? [PARCIAL_SIN_MOVER] : [];
  return { lineas: [resumen, ...lista, ...sinCsv, ...parcial], codigoSalida };
}

/** El --archivo no se pudo leer: 2 si no se puede abrir o no es un archivo regular; 1 si pasa del tope. Nunca la ruta. */
export function reporteArchivoBanrep(codigo: CodigoArchivo): ReporteBanrep {
  if (codigo === "ARCHIVO_DEMASIADO_GRANDE") {
    return { lineas: [`❌ ${codigo} · el archivo pasa del tope del lector XML: ${ACOTAR}.`], codigoSalida: SALIDA_FALLIDA };
  }
  return { lineas: [`❌ ${codigo} · no se pudo leer el --archivo indicado (debe ser un archivo regular).`], codigoSalida: SALIDA_USO };
}
