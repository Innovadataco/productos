/**
 * Armador DIARIO (E1b): del tablero (`calcularTablero`), del movimiento del día (`calcularMovimiento`), del último corte
 * de la conciliación, de las series oficiales y del fondo, el paquete de hechos del resumen diario. Puro: sin base, sin
 * red y sin reloj (`hoy` entra como parámetro).
 *
 * Grupos, por prioridad (si no cabe todo, salen enteros los de menor prioridad y el aviso lo dice):
 * 1. El portafolio, a la fecha de referencia del tablero: valor (con la dirección del neto del día), ganancias,
 *    dividendos, comisiones, la variación del día (solo si se pudo comparar), los conteos de especies sin precio y
 *    atrasadas (solo si no son cero) y las fechas de los cierres. Sin cierres, no va y el aviso dice SIN_CIERRES.
 * 2. El último corte de la conciliación, con su resultado como clave y su día como valor.
 * 3. Las series (TRM, TPM, IBR y la variación anual del IPC) y el fondo, con su propia frescura.
 * 4. Cada especie con cierre, en el orden del tablero (de mayor a menor valor).
 * La variación del día en porcentaje del portafolio no se emite: ningún módulo la calcula todavía.
 */
import type { ClaveDiario } from "../catalogo";
import type { DiaIso, PaqueteHechos } from "../contrato";
import { cerrarPaquete, borrador, frescuraConAviso, hastaHoy, type Marcas, type Parte } from "./comun";
import { FUENTES } from "./constantes";
import { deDecimal, deTextoDecimal, diaDe, exigirDia, menorDia } from "./decimal";
import { direccionDelSigno, direccionFrente, frescuraDeSerie, frescuraDelFondo, peorFrescura } from "./derivar";
import type { EntradaArmadoDiario, FilaParaHechos, MovimientoParaHechos, SerieParaHechos } from "./entradas";
import { ErrorArmado } from "./errores";
import type { BorradorHecho } from "./grupos";

type Borrador = BorradorHecho<ClaveDiario>;
type ParteDiario = Parte<ClaveDiario>;

const PRIORIDAD = Object.freeze({ PORTAFOLIO: 1, CONCILIACION: 2, SERIES: 3, ESPECIES: 4 });

/** La comparación del día: el neto, o null si no se pudo comparar. */
const netoDelDia = (m: MovimientoParaHechos): string | null => (m.motivo === null && m.neto !== null ? deDecimal(m.neto) : null);

function conteos(e: EntradaArmadoDiario, marcas: Marcas): readonly Borrador[] {
  const conteo = (clave: ClaveDiario, n: number): readonly Borrador[] => (n > 0 ? [borrador(clave, deTextoDecimal(String(n)), FUENTES.TABLERO, marcas, { obligatorio: true })] : []);
  return [...conteo("ESPECIES_SIN_PRECIO", e.tablero.especiesSinPrecio), ...conteo("ESPECIES_ATRASADAS", e.tablero.especiesAtrasadas)];
}

function portafolio(e: EntradaArmadoDiario, hoy: DiaIso): ParteDiario {
  const t = e.tablero;
  if (t.fechaReferencia === null) return { grupos: [], avisos: ["SIN_CIERRES"] };
  const referencia = diaDe(t.fechaReferencia);
  const fresca = frescuraConAviso(referencia, hoy, e.calendario);
  const marcas = { fecha: referencia, frescura: fresca.frescura, origen: "CALCULO" } as const;
  const neto = netoDelDia(e.movimiento);
  const conSigno = (clave: ClaveDiario, valor: string, obligatorio = false): Borrador =>
    borrador(clave, valor, FUENTES.TABLERO, marcas, { direccion: direccionDelSigno(valor), obligatorio });
  const viejo = t.cierreMasViejo === null ? null : diaDe(t.cierreMasViejo);
  const masViejo = viejo === null || viejo === referencia ? null : frescuraConAviso(viejo, hoy, e.calendario);
  const hechos: readonly Borrador[] = [
    borrador("VALOR_ACCIONES", deDecimal(t.valorAcciones), FUENTES.TABLERO, marcas, { direccion: neto === null ? "NO_APLICA" : direccionDelSigno(neto), obligatorio: true }),
    conSigno("GANANCIA_SIN_VENDER", deDecimal(t.sinVender)),
    conSigno("GANANCIA_POR_VENTAS", deDecimal(t.porVentas)),
    borrador("DIVIDENDOS_RECIBIDOS", deDecimal(t.dividendos), FUENTES.TABLERO, marcas),
    borrador("COMISIONES_PAGADAS", deDecimal(t.comisiones), FUENTES.TABLERO, marcas),
    conSigno("GANANCIA_TOTAL", deDecimal(t.gananciaTotal), true),
    ...(neto === null ? [] : [conSigno("VARIACION_DIA_VALOR", neto, true)]),
    ...conteos(e, marcas),
    borrador("FECHA_CIERRE_RECIENTE", referencia, FUENTES.TABLERO, marcas, { obligatorio: true }),
    ...(viejo === null || masViejo === null ? [] : [borrador("FECHA_CIERRE_MAS_ANTIGUO", viejo, FUENTES.TABLERO, { fecha: viejo, frescura: masViejo.frescura, origen: "CALCULO" })]),
  ];
  return { grupos: [{ prioridad: PRIORIDAD.PORTAFOLIO, hechos }], avisos: [...fresca.avisos, ...(masViejo?.avisos ?? [])] };
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
  const fresca = frescuraConAviso(corte, hoy, e.calendario);
  const hecho = borrador(CLAVE_DEL_RESULTADO[resultado], corte, FUENTES.CONCILIACION, { fecha: corte, frescura: fresca.frescura, origen: "CALCULO" }, { obligatorio: resultado === "NO_CUADRA" });
  return { grupos: [{ prioridad: PRIORIDAD.CONCILIACION, hechos: [hecho] }], avisos: fresca.avisos };
}

/** La clave de cada serie del catálogo de datos oficiales, según su origen. */
const CLAVE_DE_SERIE: ReadonlyMap<string, ClaveDiario> = new Map([
  ["TRM|OFICIAL", "TASA_TRM"], ["TPM|OFICIAL", "TASA_TPM"], ["IBR_3M_EA|OFICIAL", "TASA_IBR"], ["IPC_INDICE|CALCULADA", "VARIACION_ANUAL_IPC"],
]);

function claveDeSerie(s: SerieParaHechos): ClaveDiario {
  const clave = CLAVE_DE_SERIE.get(`${s.cifra.serie}|${s.cifra.origen}`);
  if (clave === undefined) throw new ErrorArmado("SERIE_DESCONOCIDA");
  return clave;
}

function hechoDeSerie(s: SerieParaHechos, clave: ClaveDiario, hoy: DiaIso): Borrador | null {
  const frescura = frescuraDeSerie(s.frescura);
  if (frescura === null) return null;
  const valor = deTextoDecimal(s.cifra.valor);
  const calculada = s.cifra.origen === "CALCULADA";
  const direccion = calculada ? direccionDelSigno(valor) : direccionFrente(valor, s.anterior === null ? null : deTextoDecimal(s.anterior));
  const fecha = menorDia(diaDe(s.cifra.hasta), hoy);
  return borrador(clave, valor, s.cifra.fuente, { fecha, frescura, origen: calculada ? "CALCULO" : "PUBLICACION_OFICIAL" }, { direccion });
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
  const frescura = frescuraDelFondo(fecha, hoy, f.atrasado);
  const oficial = { fecha, frescura, origen: "PUBLICACION_OFICIAL" } as const;
  const valorUnidad = deDecimal(f.valorUnidad);
  const hechos: readonly Borrador[] = [
    ...(f.valor === null ? [] : [borrador("FONDO_VALOR", deDecimal(f.valor), f.fuente, { ...oficial, origen: "CALCULO" })]),
    borrador("FONDO_VALOR_UNIDAD", valorUnidad, f.fuente, oficial, { direccion: direccionFrente(valorUnidad, f.valorUnidadAnterior === null ? null : deDecimal(f.valorUnidadAnterior)) }),
    borrador("FONDO_FECHA_VALOR", fecha, f.fuente, oficial),
  ];
  return { grupos: [{ prioridad: PRIORIDAD.SERIES, hechos }], avisos: [] };
}

function grupoDeEspecie(e: EntradaArmadoDiario, hoy: DiaIso, fila: FilaParaHechos, movimiento: ReadonlyMap<string, MovimientoParaHechos["especies"][number]>): ParteDiario | null {
  const { cierre, valor } = fila;
  if (cierre === null || valor === null) return null;
  const dia = diaDe(cierre.fecha);
  const fresca = frescuraConAviso(dia, hoy, e.calendario);
  const frescura = peorFrescura(fresca.frescura, fila.cierreAtrasado ? "ATRASADO" : "HOY");
  const calculo = { fecha: dia, frescura, origen: "CALCULO" } as const;
  const delCierre = { ...calculo, origen: cierre.verificado ? "CIERRE_VERIFICADO" : "CIERRE_SIN_VERIFICAR" } as const;
  const mov = movimiento.get(fila.instrumentoId);
  const deEspecie = { sujeto: "especie" } as const;
  const hechos: readonly Borrador[] = [
    borrador("ESPECIE_NOMBRE", fila.nemotecnico, FUENTES.REGISTRO, { fecha: hoy, frescura: "HOY", origen: "REGISTRO" }, { ref: "especie" }),
    borrador("VALOR_ESPECIE", deDecimal(valor), FUENTES.TABLERO, calculo, { ...deEspecie, direccion: mov ? direccionDelSigno(deDecimal(mov.aporte)) : "NO_APLICA" }),
    ...(fila.pesoPct === null ? [] : [borrador("PESO_ESPECIE", deDecimal(fila.pesoPct), FUENTES.TABLERO, calculo, deEspecie)]),
    ...(fila.rentabilidadPct === null ? [] : [borrador("RENTABILIDAD_ESPECIE", deDecimal(fila.rentabilidadPct), FUENTES.TABLERO, calculo, { ...deEspecie, direccion: direccionDelSigno(deDecimal(fila.rentabilidadPct)) })]),
    borrador("CIERRE_ESPECIE", deDecimal(cierre.precio), FUENTES.CIERRES, delCierre, { ...deEspecie, direccion: mov ? direccionDelSigno(deDecimal(mov.variacionPct)) : "NO_APLICA" }),
    ...(fila.cierreAtrasado ? [borrador("FECHA_CIERRE_ESPECIE", dia, FUENTES.CIERRES, delCierre, deEspecie)] : []),
    ...(mov ? [borrador("VARIACION_DIA_ESPECIE", deDecimal(mov.variacionPct), FUENTES.TABLERO, calculo, { ...deEspecie, direccion: direccionDelSigno(deDecimal(mov.variacionPct)) })] : []),
  ];
  return { grupos: [{ prioridad: PRIORIDAD.ESPECIES, hechos }], avisos: fresca.avisos };
}

function especies(e: EntradaArmadoDiario, hoy: DiaIso): ParteDiario {
  // Solo se compara lo que entró al par de ruedas del día: sin comparación, ninguna especie lleva variación.
  const movimiento = new Map(e.movimiento.motivo === null ? e.movimiento.especies.map((m) => [m.instrumentoId, m] as const) : []);
  const partes = e.tablero.filas.flatMap((fila) => grupoDeEspecie(e, hoy, fila, movimiento) ?? []);
  return { grupos: partes.flatMap((p) => p.grupos), avisos: partes.flatMap((p) => p.avisos) };
}

/** El paquete DIARIO, armado con `construirPaquete`. Cierra en fallo con ErrorArmado o ErrorPaquete. */
export function armarDiario(e: EntradaArmadoDiario): PaqueteHechos<"DIARIO"> {
  const hoy = exigirDia(e.hoy, "HOY_INVALIDO");
  const partes = [portafolio(e, hoy), avisoMovimiento(e), conciliacion(e, hoy), series(e, hoy), fondo(e, hoy), especies(e, hoy)];
  return cerrarPaquete("DIARIO", hoy, partes);
}
