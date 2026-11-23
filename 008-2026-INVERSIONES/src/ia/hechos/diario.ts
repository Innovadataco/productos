/**
 * Armador DIARIO (E1b): del tablero (`calcularTablero`), del movimiento del día (`calcularMovimiento`), del último corte
 * de la conciliación, de las series oficiales y del fondo, el paquete de hechos del resumen diario. Puro: sin base, sin
 * red y sin reloj (`hoy` entra como parámetro).
 *
 * Grupos, por prioridad (si no cabe todo, salen enteros los de menor prioridad y el aviso lo dice):
 * 1. El portafolio, a la fecha de referencia del tablero: valor (con la dirección del neto del día), ganancias,
 *    dividendos, comisiones, la variación del día (solo si se pudo comparar), los conteos de especies sin precio y
 *    atrasadas (solo si no son cero) y las fechas de los cierres. Sin cierres, no va y el aviso dice SIN_CIERRES.
 * 2. El último corte de la conciliación, con su resultado como clave y su día como valor. Su frescura es la del
 *    calendario BVC: un corte de hace más de una rueda sale ATRASADO (un umbral propio de la conciliación está por decidir).
 * 3. Las series (TRM, TPM, IBR y la variación anual del IPC), con la fuente de su catálogo, y el fondo, con la de la SFC;
 *    cada una con su propia frescura.
 * 4. Cada especie con cierre, en el orden del tablero (de mayor a menor valor).
 * La variación del día en porcentaje del portafolio no se emite: ningún módulo la calcula todavía.
 */
import type { ClaveDiario } from "../catalogo";
import type { DiaIso, PaqueteHechos } from "../contrato";
import { serieDelCatalogo } from "../../datos-oficiales/catalogo";
import { borrador, cerrarPaquete, conOrigen, hastaHoy, marcasConFrescura, marcasDeHoy, marcasDeMercado, type Marcas, type Parte } from "./comun";
import { FUENTES } from "./constantes";
import { deDecimal, deEntero, deTextoDecimal, diaDe, exigirDia, menorDia } from "./decimal";
import { direccionDelSigno, direccionFrente, frescuraDeSerie, frescuraDelFondo } from "./derivar";
import type { EntradaArmadoDiario, FilaParaHechos, MovimientoParaHechos, SerieParaHechos } from "./entradas";
import { ErrorArmado } from "./errores";
import type { BorradorHecho } from "./grupos";

type Borrador = BorradorHecho<ClaveDiario>;
type ParteDiario = Parte<ClaveDiario>;

const PRIORIDAD = Object.freeze({ PORTAFOLIO: 1, CONCILIACION: 2, SERIES: 3, ESPECIES: 4 });

/**
 * Las claves que el resumen DIARIO tiene que citar (si el hecho está en el paquete). Ninguna es de una especie: el
 * armador no arrastra nombres de especie como obligatorios. Caben en el tope (`MAX_OBLIGATORIOS`) y en las frases.
 */
export const OBLIGATORIOS_DIARIO: readonly ClaveDiario[] = Object.freeze([
  "VALOR_ACCIONES", "VARIACION_DIA_VALOR", "GANANCIA_TOTAL", "ESPECIES_SIN_PRECIO", "ESPECIES_ATRASADAS", "CONCILIACION_NO_CUADRA",
]);
const esObligatorio = (clave: ClaveDiario): boolean => OBLIGATORIOS_DIARIO.includes(clave);

/** La comparación del día: el neto, o null si no se pudo comparar. */
const netoDelDia = (m: MovimientoParaHechos): string | null => (m.motivo === null && m.neto !== null ? deDecimal(m.neto) : null);

function conteos(e: EntradaArmadoDiario, marcas: Marcas): readonly Borrador[] {
  const conteo = (clave: ClaveDiario, n: number): readonly Borrador[] => (n > 0 ? [borrador(clave, deEntero(n), FUENTES.TABLERO, marcas, { obligatorio: esObligatorio(clave) })] : []);
  return [...conteo("ESPECIES_SIN_PRECIO", e.tablero.especiesSinPrecio), ...conteo("ESPECIES_ATRASADAS", e.tablero.especiesAtrasadas)];
}

/** La fecha del cierre más viejo, solo si es distinta de la referencia. */
function cierreMasViejo(e: EntradaArmadoDiario, hoy: DiaIso, referencia: DiaIso): { readonly hechos: readonly Borrador[]; readonly avisos: ParteDiario["avisos"] } {
  const viejo = e.tablero.cierreMasViejo === null ? null : diaDe(e.tablero.cierreMasViejo);
  if (viejo === null || viejo === referencia) return { hechos: [], avisos: [] };
  const { marcas, avisos } = marcasDeMercado(viejo, hoy, e.calendario, "CALCULO");
  return { hechos: [borrador("FECHA_CIERRE_MAS_ANTIGUO", viejo, FUENTES.TABLERO, marcas)], avisos };
}

function portafolio(e: EntradaArmadoDiario, hoy: DiaIso): ParteDiario {
  const t = e.tablero;
  if (t.fechaReferencia === null) return { grupos: [], avisos: ["SIN_CIERRES"] };
  const referencia = diaDe(t.fechaReferencia);
  const { marcas, avisos } = marcasDeMercado(referencia, hoy, e.calendario, "CALCULO");
  const neto = netoDelDia(e.movimiento);
  const conSigno = (clave: ClaveDiario, valor: string): Borrador =>
    borrador(clave, valor, FUENTES.TABLERO, marcas, { direccion: direccionDelSigno(valor), obligatorio: esObligatorio(clave) });
  const viejo = cierreMasViejo(e, hoy, referencia);
  const hechos: readonly Borrador[] = [
    borrador("VALOR_ACCIONES", deDecimal(t.valorAcciones), FUENTES.TABLERO, marcas, { direccion: neto === null ? "NO_APLICA" : direccionDelSigno(neto), obligatorio: esObligatorio("VALOR_ACCIONES") }),
    conSigno("GANANCIA_SIN_VENDER", deDecimal(t.sinVender)),
    conSigno("GANANCIA_POR_VENTAS", deDecimal(t.porVentas)),
    borrador("DIVIDENDOS_RECIBIDOS", deDecimal(t.dividendos), FUENTES.TABLERO, marcas),
    borrador("COMISIONES_PAGADAS", deDecimal(t.comisiones), FUENTES.TABLERO, marcas),
    conSigno("GANANCIA_TOTAL", deDecimal(t.gananciaTotal)),
    ...(neto === null ? [] : [conSigno("VARIACION_DIA_VALOR", neto)]),
    ...conteos(e, marcas),
    borrador("FECHA_CIERRE_RECIENTE", referencia, FUENTES.TABLERO, marcas),
    ...viejo.hechos,
  ];
  return { grupos: [{ prioridad: PRIORIDAD.PORTAFOLIO, hechos }], avisos: [...avisos, ...viejo.avisos] };
}

function avisoMovimiento(e: EntradaArmadoDiario): ParteDiario {
  const { motivo } = e.movimiento;
  return { grupos: [], avisos: motivo === null ? [] : [`MOVIMIENTO_${motivo}` as const] };
}

const CLAVE_DEL_RESULTADO = Object.freeze({ CUADRA: "CONCILIACION_CUADRA", PARCIAL: "CONCILIACION_PARCIAL", NO_CUADRA: "CONCILIACION_NO_CUADRA" } as const);

function conciliacion(e: EntradaArmadoDiario, hoy: DiaIso): ParteDiario {
  if (e.conciliacion === null) return { grupos: [], avisos: ["CONCILIACION_SIN_CORTE"] };
  const { resultado } = e.conciliacion;
  if (resultado === null) return { grupos: [], avisos: ["CONCILIACION_PENDIENTE"] };
  const corte = diaDe(e.conciliacion.fechaCorte);
  const { marcas, avisos } = marcasDeMercado(corte, hoy, e.calendario, "CALCULO");
  const hecho = borrador(CLAVE_DEL_RESULTADO[resultado], corte, FUENTES.CONCILIACION, marcas, { obligatorio: esObligatorio(CLAVE_DEL_RESULTADO[resultado]) });
  return { grupos: [{ prioridad: PRIORIDAD.CONCILIACION, hechos: [hecho] }], avisos };
}

/** La clave de cada serie del catálogo de datos oficiales, según su origen. */
const CLAVE_DE_SERIE: ReadonlyMap<string, ClaveDiario> = new Map([
  ["TRM|OFICIAL", "TASA_TRM"], ["TPM|OFICIAL", "TASA_TPM"], ["IBR_3M_EA|OFICIAL", "TASA_IBR"], ["IPC_INDICE|CALCULADA", "VARIACION_ANUAL_IPC"],
]);

/** La clave de la serie, y su fuente debe ser exactamente la de su catálogo (nunca un texto libre de quien llama). */
function claveDeSerie(s: SerieParaHechos): ClaveDiario {
  const clave = CLAVE_DE_SERIE.get(`${s.cifra.serie}|${s.cifra.origen}`);
  if (clave === undefined) throw new ErrorArmado("SERIE_DESCONOCIDA");
  if (serieDelCatalogo(s.cifra.serie)?.fuente !== s.cifra.fuente) throw new ErrorArmado("FUENTE_DESCONOCIDA", clave);
  return clave;
}

function hechoDeSerie(s: SerieParaHechos, clave: ClaveDiario, hoy: DiaIso): Borrador | null {
  const frescura = frescuraDeSerie(s.frescura);
  if (frescura === null) return null;
  const valor = deTextoDecimal(s.cifra.valor);
  const calculada = s.cifra.origen === "CALCULADA";
  const direccion = calculada ? direccionDelSigno(valor) : direccionFrente(valor, s.anterior === null ? null : deTextoDecimal(s.anterior));
  // La vigencia de la TRM se publica por adelantado (su `hasta` puede ser posterior a hoy): el dato vale hoy, con fecha hoy.
  const fecha = menorDia(diaDe(s.cifra.hasta), hoy);
  return borrador(clave, valor, s.cifra.fuente, marcasConFrescura(fecha, hoy, frescura, calculada ? "CALCULO" : "PUBLICACION_OFICIAL"), { direccion });
}

function series(e: EntradaArmadoDiario, hoy: DiaIso): ParteDiario {
  const claves = e.series.map(claveDeSerie);
  if (new Set(claves).size !== claves.length) throw new ErrorArmado("SERIE_REPETIDA");
  const hechos = e.series.flatMap((s, i) => hechoDeSerie(s, claves[i] as ClaveDiario, hoy) ?? []);
  return { grupos: [{ prioridad: PRIORIDAD.SERIES, hechos }], avisos: [] };
}

function fondo(e: EntradaArmadoDiario, hoy: DiaIso): ParteDiario {
  const f = e.fondo;
  if (f === null) return { grupos: [], avisos: [] };
  const fecha = hastaHoy(diaDe(f.fecha), hoy);
  const oficial = marcasConFrescura(fecha, hoy, frescuraDelFondo(fecha, hoy, f.atrasado), "PUBLICACION_OFICIAL");
  const valorUnidad = deDecimal(f.valorUnidad);
  const anterior = f.valorUnidadAnterior === null ? null : deDecimal(f.valorUnidadAnterior);
  const hechos: readonly Borrador[] = [
    ...(f.valor === null ? [] : [borrador("FONDO_VALOR", deDecimal(f.valor), FUENTES.FONDO, conOrigen(oficial, "CALCULO"))]),
    borrador("FONDO_VALOR_UNIDAD", valorUnidad, FUENTES.FONDO, oficial, { direccion: direccionFrente(valorUnidad, anterior) }),
    borrador("FONDO_FECHA_VALOR", fecha, FUENTES.FONDO, oficial),
  ];
  return { grupos: [{ prioridad: PRIORIDAD.SERIES, hechos }], avisos: [] };
}

type MovimientoDeEspecie = MovimientoParaHechos["especies"][number];

function grupoDeEspecie(e: EntradaArmadoDiario, hoy: DiaIso, fila: FilaParaHechos, mov: MovimientoDeEspecie | undefined): ParteDiario | null {
  const { cierre, valor } = fila;
  if (cierre === null || valor === null) return null;
  const dia = diaDe(cierre.fecha);
  const { marcas: calculo, avisos } = marcasDeMercado(dia, hoy, e.calendario, "CALCULO", fila.cierreAtrasado);
  const delCierre = conOrigen(calculo, cierre.verificado ? "CIERRE_VERIFICADO" : "CIERRE_SIN_VERIFICAR");
  const especie = borrador("ESPECIE_NOMBRE", fila.nemotecnico, FUENTES.REGISTRO, marcasDeHoy(hoy, "REGISTRO"));
  const de = { sujeto: especie } as const;
  const conSigno = (v: string) => ({ ...de, direccion: direccionDelSigno(v) });
  const hechos: readonly Borrador[] = [
    especie,
    borrador("VALOR_ESPECIE", deDecimal(valor), FUENTES.TABLERO, calculo, mov ? conSigno(deDecimal(mov.aporte)) : de),
    ...(fila.pesoPct === null ? [] : [borrador("PESO_ESPECIE", deDecimal(fila.pesoPct), FUENTES.TABLERO, calculo, de)]),
    ...(fila.rentabilidadPct === null ? [] : [borrador("RENTABILIDAD_ESPECIE", deDecimal(fila.rentabilidadPct), FUENTES.TABLERO, calculo, conSigno(deDecimal(fila.rentabilidadPct)))]),
    borrador("CIERRE_ESPECIE", deDecimal(cierre.precio), FUENTES.CIERRES, delCierre, mov ? conSigno(deDecimal(mov.variacionPct)) : de),
    ...(fila.cierreAtrasado ? [borrador("FECHA_CIERRE_ESPECIE", dia, FUENTES.CIERRES, delCierre, de)] : []),
    ...(mov ? [borrador("VARIACION_DIA_ESPECIE", deDecimal(mov.variacionPct), FUENTES.TABLERO, calculo, conSigno(deDecimal(mov.variacionPct)))] : []),
  ];
  return { grupos: [{ prioridad: PRIORIDAD.ESPECIES, hechos }], avisos };
}

function especies(e: EntradaArmadoDiario, hoy: DiaIso): ParteDiario {
  // Solo se compara lo que entró al par de ruedas del día: sin comparación, ninguna especie lleva variación.
  const movimiento = new Map(e.movimiento.motivo === null ? e.movimiento.especies.map((m) => [m.instrumentoId, m] as const) : []);
  const partes = e.tablero.filas.flatMap((fila) => grupoDeEspecie(e, hoy, fila, movimiento.get(fila.instrumentoId)) ?? []);
  return { grupos: partes.flatMap((p) => p.grupos), avisos: partes.flatMap((p) => p.avisos) };
}

/** El paquete DIARIO, armado con `construirPaquete`. Cierra en fallo con ErrorArmado o ErrorPaquete. */
export function armarDiario(e: EntradaArmadoDiario): PaqueteHechos<"DIARIO"> {
  const hoy = exigirDia(e.hoy, "HOY_INVALIDO");
  const partes = [portafolio(e, hoy), avisoMovimiento(e), conciliacion(e, hoy), series(e, hoy), fondo(e, hoy), especies(e, hoy)];
  return cerrarPaquete("DIARIO", hoy, partes);
}
