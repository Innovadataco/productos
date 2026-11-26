/**
 * Entradas INVENTADAS del armador DIARIO (E7): un tablero con sus especies (unas con cierre atrasado o sin verificar),
 * el movimiento del día (a veces sin comparación), la conciliación (o su falta), las series oficiales y el fondo. Las
 * cifras salen del azar con semilla y cuadran entre sí (los totales son la suma de las especies). Especies FICTICIA-*.
 */
import { Prisma } from "@prisma/client";
import { serieDelCatalogo } from "../../../datos-oficiales/catalogo";
import type { Prng } from "../../../proyecciones/prng";
import type { EntradaArmadoDiario, FilaParaHechos, FondoParaHechos, MovimientoParaHechos, SerieParaHechos } from "../../hechos";
import { CALENDARIO_INVENTADO, decimal, dentroDelAnio, dia, elegir, entero, habilDesde, hoyInventado, instrumento, nombres, real, siQue } from "./comun.ficticio";

/** Especies por caso; dos casos llevan muchas para llegar al tope de 99 hechos (y al aviso HECHOS_RECORTADOS). */
const ESPECIES_EN_EL_TOPE = 19;
const CASOS_EN_EL_TOPE: ReadonlySet<number> = new Set([4, 11]);
const CIEN = new Prisma.Decimal(100);

interface Especie {
  readonly fila: FilaParaHechos;
  readonly sinVender: Prisma.Decimal;
  readonly variacionPct: number | null;
}

function especie(p: Prng, nombre: string, referencia: string, atrasadoForzado?: boolean): Especie {
  const precio = decimal(real(p, 1237, 97_131), 2);
  const valor = decimal(precio.toNumber() * entero(p, 13, 913), 2);
  const rentabilidad = real(p, -23, 41);
  const sinVender = decimal(valor.toNumber() - valor.toNumber() / (1 + rentabilidad / 100), 2);
  const atrasado = atrasadoForzado ?? siQue(p, 0.15);
  const fecha = atrasado ? habilDesde(referencia, -entero(p, 2, 6)) : referencia;
  const fila = {
    instrumentoId: instrumento(nombre), nemotecnico: nombre, valor, pesoPct: null, rentabilidadPct: decimal(rentabilidad, 4),
    cierre: { precio, fecha: dia(fecha), verificado: siQue(p, 0.7) }, cierreAtrasado: atrasado,
  };
  return { fila, sinVender, variacionPct: atrasado ? null : Number(real(p, -3.7, 3.9).toFixed(4)) };
}

function conPesos(especies: readonly Especie[], total: Prisma.Decimal): readonly FilaParaHechos[] {
  return especies.map((e) => ({ ...e.fila, pesoPct: (e.fila.valor as Prisma.Decimal).div(total).mul(CIEN).toDecimalPlaces(4) }));
}

/** `forzado` solo lo usan los casos grandes: con comparación del día o sin rueda previa. Sin él, el azar de siempre. */
function movimiento(p: Prng, especies: readonly Especie[], forzado?: ComparacionDelDia): MovimientoParaHechos {
  if (forzado === "SIN_RUEDA_PREVIA") return { neto: null, motivo: "SIN_RUEDA_PREVIA", especies: [] };
  if (forzado === undefined && siQue(p, 0.2)) return { neto: null, motivo: elegir(p, ["SIN_RUEDA_PREVIA", "REFERENCIA_NO_HABIL"] as const), especies: [] };
  const conVariacion = especies.flatMap((e) => (e.variacionPct === null ? [] : [{ e, v: e.variacionPct }]));
  const lista = conVariacion.map(({ e, v }) => ({
    instrumentoId: e.fila.instrumentoId,
    aporte: decimal(((e.fila.valor as Prisma.Decimal).toNumber() * v) / (100 + v), 2),
    variacionPct: new Prisma.Decimal(v.toFixed(4)),
  }));
  const neto = lista.reduce((suma, x) => suma.add(x.aporte), new Prisma.Decimal(0));
  return { neto, motivo: null, especies: lista };
}

/** Con `todas`, las cuatro series (TRM, TPM, IBR e IPC): los casos grandes. Sin él, las que da el azar. */
function series(p: Prng, hoy: string, todas = false): readonly SerieParaHechos[] {
  const fuente = (codigo: string): string => serieDelCatalogo(codigo)?.fuente ?? "";
  const trm = real(p, 3713, 4613);
  const lista: SerieParaHechos[] = [{
    cifra: { serie: "TRM", valor: trm.toFixed(2), hasta: dia(hoy), fuente: fuente("TRM"), origen: "OFICIAL" },
    frescura: { estado: "AL_DIA", cubreHoy: true }, anterior: (trm + real(p, -41, 37)).toFixed(2),
  }];
  if (todas || siQue(p, 0.8)) {
    const atrasada = siQue(p, 0.25);
    lista.push({
      cifra: { serie: "TPM", valor: real(p, 6.1, 9.9).toFixed(2), hasta: dia(atrasada ? dentroDelAnio(habilDesde(hoy, -entero(p, 9, 21))) : hoy), fuente: fuente("TPM"), origen: "OFICIAL" },
      frescura: { estado: atrasada ? "ATRASADA" : "AL_DIA", cubreHoy: !atrasada }, anterior: siQue(p, 0.5) ? real(p, 6.1, 9.9).toFixed(2) : null,
    });
  }
  if (todas || siQue(p, 0.7)) {
    lista.push({
      cifra: { serie: "IBR_3M_EA", valor: real(p, 6.3, 10.7).toFixed(3), hasta: dia(habilDesde(hoy, -1)), fuente: fuente("IBR_3M_EA"), origen: "OFICIAL" },
      frescura: { estado: "AL_DIA", cubreHoy: false }, anterior: real(p, 6.3, 10.7).toFixed(3),
    });
  }
  if (todas || siQue(p, 0.6)) {
    const finDelMesAnterior = new Date(Date.UTC(dia(hoy).getUTCFullYear(), dia(hoy).getUTCMonth(), 0));
    lista.push({
      cifra: { serie: "IPC_INDICE", valor: real(p, 3.1, 6.7).toFixed(2), hasta: finDelMesAnterior, fuente: fuente("IPC_INDICE"), origen: "CALCULADA" },
      frescura: { estado: elegir(p, ["AL_DIA", "ATRASADA"] as const), cubreHoy: false }, anterior: null,
    });
  }
  return lista;
}

function fondo(p: Prng, hoy: string, siempre = false): FondoParaHechos | null {
  if (!siempre && !siQue(p, 0.7)) return null;
  const valorUnidad = real(p, 10_013, 13_997);
  const atrasado = siQue(p, 0.1);
  return {
    valorUnidad: decimal(valorUnidad, 6),
    valorUnidadAnterior: siQue(p, 0.9) ? decimal(valorUnidad - real(p, -1.3, 4.7), 6) : null,
    fecha: dia(dentroDelAnio(habilDesde(hoy, atrasado ? -entero(p, 9, 13) : -2))),
    atrasado,
    valor: siempre || siQue(p, 0.8) ? decimal(real(p, 413_137, 9_713_713), 2) : null,
  };
}

function conciliacion(p: Prng, hoy: string, siempre = false): EntradaArmadoDiario["conciliacion"] {
  if (!siempre && siQue(p, 0.12)) return null;
  const fechaCorte = dia(dentroDelAnio(habilDesde(hoy, -entero(p, 3, 19))));
  return { fechaCorte, resultado: siQue(p, 0.1) ? null : elegir(p, ["CUADRA", "PARCIAL", "NO_CUADRA"] as const) };
}

/** Los casos que sí llevan los casos grandes: cuántos casos hay antes de ellos y cómo se compara el día en cada uno. */
const PRIMER_CASO_GRANDE = 15;
type ComparacionDelDia = "CON_COMPARACION" | "SIN_RUEDA_PREVIA";
const COMPARACION_GRANDES: readonly ComparacionDelDia[] = ["CON_COMPARACION", "SIN_RUEDA_PREVIA"];
/** Diez especies, de FICTICIA-A a FICTICIA-J, con dos de cierre atrasado (la cuarta y la octava): como un portafolio real. */
const ESPECIES_GRANDES: readonly string[] = Array.from({ length: 10 }, (_, i) => `FICTICIA-${String.fromCharCode(65 + i)}`);
const ATRASADAS_GRANDES: ReadonlySet<number> = new Set([3, 7]);

/**
 * Los casos grandes (DIARIO-16 y DIARIO-17): el portafolio completo de diez especies, con las cuatro series, el fondo, la
 * conciliación y una especie sin precio; el 16 con la comparación del día y el 17 sin rueda previa. Cada pieza va
 * forzada (no sale del azar de cada caso) para que el tamaño del paquete sea el de un portafolio real.
 */
function entradaDiarioGrande(p: Prng, comparacion: ComparacionDelDia): EntradaArmadoDiario {
  const hoy = hoyInventado(p);
  const lista = ESPECIES_GRANDES.map((n, i) => especie(p, n, hoy, ATRASADAS_GRANDES.has(i)));
  const total = lista.reduce((s, e) => s.add(e.fila.valor as Prisma.Decimal), new Prisma.Decimal(0));
  const sinVender = lista.reduce((s, e) => s.add(e.sinVender), new Prisma.Decimal(0));
  const porVentas = decimal(real(p, -4613, 9713), 2);
  const dividendos = decimal(real(p, 13, 4613), 2);
  const comisiones = decimal(real(p, 13, 913), 2);
  const fechas = lista.map((e) => e.fila.cierre?.fecha.getTime() ?? 0);
  return {
    hoy, calendario: CALENDARIO_INVENTADO,
    tablero: {
      filas: conPesos(lista, total), valorAcciones: total, sinVender, porVentas, dividendos, comisiones,
      gananciaTotal: sinVender.add(porVentas).add(dividendos).sub(comisiones), especiesSinPrecio: 1,
      especiesAtrasadas: lista.filter((e) => e.fila.cierreAtrasado).length, fechaReferencia: dia(hoy), cierreMasViejo: new Date(Math.min(...fechas)),
    },
    movimiento: movimiento(p, lista, comparacion),
    conciliacion: conciliacion(p, hoy, true),
    series: series(p, hoy, true),
    fondo: fondo(p, hoy, true),
  };
}

/** La entrada DIARIO número `indice` (desde 0), con el azar dado. Los dos últimos son los casos grandes. */
export function entradaDiarioInventada(p: Prng, indice: number): EntradaArmadoDiario {
  const grande = COMPARACION_GRANDES[indice - PRIMER_CASO_GRANDE];
  if (grande !== undefined) return entradaDiarioGrande(p, grande);
  const hoy = hoyInventado(p);
  const referencia = siQue(p, 0.5) ? hoy : habilDesde(hoy, -1);
  const lista = nombres(p, CASOS_EN_EL_TOPE.has(indice) ? ESPECIES_EN_EL_TOPE : entero(p, 2, 6)).map((n) => especie(p, n, referencia));
  const total = lista.reduce((s, e) => s.add(e.fila.valor as Prisma.Decimal), new Prisma.Decimal(0));
  const sinVender = lista.reduce((s, e) => s.add(e.sinVender), new Prisma.Decimal(0));
  const porVentas = decimal(real(p, -4613, 9713), 2);
  const dividendos = siQue(p, 0.3) ? new Prisma.Decimal(0) : decimal(real(p, 13, 4613), 2);
  const comisiones = decimal(real(p, 13, 913), 2);
  const fechas = lista.map((e) => e.fila.cierre?.fecha.getTime() ?? 0);
  const sinPrecio = siQue(p, 0.15) ? 1 : 0;
  return {
    hoy, calendario: CALENDARIO_INVENTADO,
    tablero: {
      filas: conPesos(lista, total), valorAcciones: total, sinVender, porVentas, dividendos, comisiones,
      gananciaTotal: sinVender.add(porVentas).add(dividendos).sub(comisiones), especiesSinPrecio: sinPrecio,
      especiesAtrasadas: lista.filter((e) => e.fila.cierreAtrasado).length, fechaReferencia: dia(referencia), cierreMasViejo: new Date(Math.min(...fechas)),
    },
    movimiento: movimiento(p, lista),
    conciliacion: conciliacion(p, hoy),
    series: series(p, hoy),
    fondo: fondo(p, hoy),
  };
}
