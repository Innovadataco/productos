/**
 * Conciliación por fecha de corte contra la certificación de A&V (hito 1, GATE 1 aprobada). Cálculo puro:
 * recibe lo certificado y lo que calcula el sistema AL CORTE (nunca «a hoy») y devuelve un control por regla,
 * con lo esperado (sistema), lo real (certificación), la diferencia (real − esperado), la tolerancia y el porqué.
 * - CANTIDAD por especie: liquidado al corte, diferencia 0. Si cuadra con lo operado (T+2 por liquidar),
 *   PENDIENTE_LIQUIDACION «t_mas_2».
 * - VALOR por especie y total de acciones: cantidad liquidada × cierre del día EXACTO del corte, ±0,5 % del
 *   certificado. Sin cierre: «sin_precio_al_corte» (nunca el día anterior).
 * - FONDO: unidades del sistema × valor de unidad de la SFC del corte, ±0,5 %. Sin unidades: «fondo_sin_unidades»
 *   (no se derivan del saldo: sería inventar el dato).
 * - EFECTIVO: ±1 COP absoluto (libro de caja; decisión del CEO). Si no, el porqué y la cifra sin explicar.
 * - El total que no cuadra dice «fecha_corte_dudosa» si todas las especies (2 o más) difieren del cierre del corte, o
 *   si todas cuadran con el cierre del día hábil anterior (`corteReal`, frente certificacion-corte-real), aunque
 *   alguna también cuadre con el del corte; en ese caso el detalle lleva `fechaSugerida` (ese día hábil anterior).
 * Resultado global: CUADRA si todo cuadra; PARCIAL si lo único pendiente es T+2; NO_CUADRA en otro caso.
 * v2: la regla del día hábil anterior y `fechaSugerida` (una conciliación v1 guardada queda DESACTUALIZADA).
 */
import { Prisma } from "@prisma/client";
import { corteReal } from "./corte-real";

export const VERSION_CALCULO = "conciliacion-v2";
export const TOLERANCIA_VALOR = "0.005";
export const TOLERANCIA_EFECTIVO_COP = "1";
const ESCALA = 6;

type Resultado = "CUADRA" | "NO_CUADRA" | "PENDIENTE_LIQUIDACION";
type TipoControl = "CANTIDAD" | "VALOR" | "FONDO" | "EFECTIVO";

export interface EspecieEntrada {
  readonly instrumentoId: string;
  /** null: la especie está en el sistema pero no en la certificación. */
  readonly certificada: { readonly cantidad: bigint; readonly precioValoracion: string; readonly valorMercado: string } | null;
  /** Compras − ventas aprobadas con liquidación ≤ corte, más los lotes de escisión liquidados. */
  readonly liquidada: bigint;
  /** Lo mismo por fecha de operación ≤ corte. */
  readonly operada: bigint;
  /** Órdenes operadas hasta el corte que liquidan después. */
  readonly pendientes: number;
  /** Cierre vigente del día exacto del corte, o null. */
  readonly cierre: string | null;
  /** Cierre vigente del día hábil anterior al corte (calendario_bvc), o null. Solo para ver si el corte es otro. */
  readonly cierreAnterior: string | null;
  /** Destino de una escisión cuyo lote no se registró. */
  readonly escisionSinLote: boolean;
}

export interface FondoEntrada {
  readonly instrumentoId: string;
  readonly saldoCertificado: string;
  readonly unidades: string | null;
  readonly valorUnidad: string | null;
}

export interface EfectivoEntrada {
  readonly certificado: string;
  readonly liquidado: string;
  readonly operado: string;
  readonly hayFondo: boolean;
  readonly aporteFondoRegistrado: boolean;
}

export interface EntradasConciliacion {
  readonly especies: readonly EspecieEntrada[];
  readonly fondos: readonly FondoEntrada[];
  readonly efectivo: EfectivoEntrada;
  /** Día hábil anterior al corte (AAAA-MM-DD) según calendario_bvc; null si su año no está sembrado. */
  readonly diaAnterior: string | null;
}

export interface Control {
  readonly tipo: TipoControl;
  readonly instrumentoId: string | null;
  readonly esperado: string | null;
  readonly real: string | null;
  readonly diferencia: string | null;
  readonly tolerancia: string | null;
  readonly resultado: Resultado;
  readonly codigoMotivo: string | null;
  readonly detalle: Readonly<Record<string, string | number>> | null;
}

export interface Conciliado {
  readonly resultado: "CUADRA" | "NO_CUADRA" | "PARCIAL";
  readonly controles: readonly Control[];
}

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const txt = (d: Prisma.Decimal) => d.toDecimalPlaces(ESCALA).toString();
const dentroRelativo = (esperado: Prisma.Decimal, real: Prisma.Decimal) => real.sub(esperado).abs().lte(real.abs().mul(TOLERANCIA_VALOR));

function control(tipo: TipoControl, instrumentoId: string | null, valores: Partial<Omit<Control, "tipo" | "instrumentoId">>): Control {
  return { tipo, instrumentoId, esperado: null, real: null, diferencia: null, tolerancia: null, resultado: "CUADRA", codigoMotivo: null, detalle: null, ...valores };
}

function motivoCantidad(e: EspecieEntrada, real: bigint): { resultado: Resultado; codigoMotivo: string | null; detalle?: Record<string, string | number> } {
  if (real === e.liquidada) return { resultado: "CUADRA", codigoMotivo: null };
  if (real === e.operada) return { resultado: "PENDIENTE_LIQUIDACION", codigoMotivo: "t_mas_2", detalle: { pendientes: e.pendientes, operada: e.operada.toString() } };
  if (e.certificada === null) return { resultado: "NO_CUADRA", codigoMotivo: "no_certificada" };
  if (e.liquidada === 0n && e.operada === 0n) return { resultado: "NO_CUADRA", codigoMotivo: e.escisionSinLote ? "escision_sin_lote" : "sin_operaciones_en_sistema" };
  return { resultado: "NO_CUADRA", codigoMotivo: "diferencia_cantidad" };
}

function controlCantidad(e: EspecieEntrada): Control {
  const real = e.certificada?.cantidad ?? 0n;
  const m = motivoCantidad(e, real);
  return control("CANTIDAD", e.instrumentoId, {
    esperado: e.liquidada.toString(), real: real.toString(), diferencia: (real - e.liquidada).toString(), tolerancia: "0", ...m, detalle: m.detalle ?? null,
  });
}

/** Con T+2 pendiente (la certificación cuenta lo operado), se valora con lo operado; si no, con lo liquidado. */
const cantidadValuada = (e: EspecieEntrada, pendiente: boolean): bigint => (pendiente ? e.operada : e.liquidada);

const precioDistinto = (e: EspecieEntrada) =>
  e.certificada !== null && e.cierre !== null && !dentroRelativo(D(e.cierre), D(e.certificada.precioValoracion));

const PENDIENTE = { resultado: "PENDIENTE_LIQUIDACION", codigoMotivo: "t_mas_2" } as const;

function controlValor(e: EspecieEntrada & { certificada: NonNullable<EspecieEntrada["certificada"]> }, cantidad: Resultado): Control {
  const real = D(e.certificada.valorMercado);
  const base = { real: txt(real), tolerancia: TOLERANCIA_VALOR };
  if (e.cierre === null) return control("VALOR", e.instrumentoId, { ...base, resultado: "NO_CUADRA", codigoMotivo: "sin_precio_al_corte" });
  const pendiente = cantidad === "PENDIENTE_LIQUIDACION";
  const esperado = D(e.cierre).mul(cantidadValuada(e, pendiente).toString());
  const valores = { ...base, esperado: txt(esperado), diferencia: txt(real.sub(esperado)) };
  if (dentroRelativo(esperado, real)) return control("VALOR", e.instrumentoId, pendiente ? { ...valores, ...PENDIENTE } : valores);
  if (cantidad === "NO_CUADRA") return control("VALOR", e.instrumentoId, { ...valores, resultado: "NO_CUADRA", codigoMotivo: "por_cantidad" });
  const motivo = precioDistinto(e) ? "precio_distinto" : "diferencia_valor";
  return control("VALOR", e.instrumentoId, { ...valores, resultado: "NO_CUADRA", codigoMotivo: motivo, detalle: { cierre: e.cierre, precioValoracion: e.certificada.precioValoracion } });
}

/** El día hábil anterior si la certificación es la foto de su cierre (`corteReal`); si no, null. */
function fechaSugerida(certificadas: readonly EspecieEntrada[], diaAnterior: string | null): string | null {
  if (diaAnterior === null) return null;
  const precios = certificadas.map((e) => ({ precioValoracion: e.certificada!.precioValoracion, cierre: e.cierre, cierreAnterior: e.cierreAnterior }));
  return corteReal(precios) === null ? null : diaAnterior;
}

function controlValorTotal(especies: readonly EspecieEntrada[], pendientes: ReadonlySet<string>, diaAnterior: string | null): Control {
  const certificadas = especies.filter((e) => e.certificada !== null);
  const real = certificadas.reduce((s, e) => s.add(e.certificada!.valorMercado), D(0));
  const base = { real: txt(real), tolerancia: TOLERANCIA_VALOR, detalle: { alcance: "total_acciones" } };
  if (certificadas.some((e) => e.cierre === null)) return control("VALOR", null, { ...base, resultado: "NO_CUADRA", codigoMotivo: "sin_precio_al_corte" });
  const esperado = certificadas.reduce((s, e) => s.add(D(e.cierre!).mul(cantidadValuada(e, pendientes.has(e.instrumentoId)).toString())), D(0));
  const valores = { ...base, esperado: txt(esperado), diferencia: txt(real.sub(esperado)) };
  if (dentroRelativo(esperado, real)) return control("VALOR", null, certificadas.some((e) => pendientes.has(e.instrumentoId)) ? { ...valores, ...PENDIENTE } : valores);
  const sugerida = fechaSugerida(certificadas, diaAnterior);
  const dudosa = sugerida !== null || (certificadas.length >= 2 && certificadas.every(precioDistinto));
  const detalle = sugerida === null ? base.detalle : { ...base.detalle, fechaSugerida: sugerida };
  return control("VALOR", null, { ...valores, detalle, resultado: "NO_CUADRA", codigoMotivo: dudosa ? "fecha_corte_dudosa" : "por_especies" });
}

function controlFondo(f: FondoEntrada): Control {
  const real = D(f.saldoCertificado);
  const base = { real: txt(real), tolerancia: TOLERANCIA_VALOR };
  if (f.unidades === null) return control("FONDO", f.instrumentoId, { ...base, resultado: "NO_CUADRA", codigoMotivo: "fondo_sin_unidades" });
  if (f.valorUnidad === null) return control("FONDO", f.instrumentoId, { ...base, resultado: "NO_CUADRA", codigoMotivo: "sin_valor_unidad_al_corte" });
  const esperado = D(f.unidades).mul(f.valorUnidad);
  const valores = { ...base, esperado: txt(esperado), diferencia: txt(real.sub(esperado)) };
  return dentroRelativo(esperado, real) ? control("FONDO", f.instrumentoId, valores) : control("FONDO", f.instrumentoId, { ...valores, resultado: "NO_CUADRA", codigoMotivo: "diferencia_fondo" });
}

function controlEfectivo(e: EfectivoEntrada): Control {
  const real = D(e.certificado);
  const diferencia = real.sub(e.liquidado);
  const valores = { esperado: txt(D(e.liquidado)), real: txt(real), diferencia: txt(diferencia), tolerancia: TOLERANCIA_EFECTIVO_COP };
  if (diferencia.abs().lte(TOLERANCIA_EFECTIVO_COP)) return control("EFECTIVO", null, valores);
  if (real.sub(e.operado).abs().lte(TOLERANCIA_EFECTIVO_COP)) return control("EFECTIVO", null, { ...valores, resultado: "PENDIENTE_LIQUIDACION", codigoMotivo: "t_mas_2", detalle: { operado: txt(D(e.operado)) } });
  const motivo = e.hayFondo && !e.aporteFondoRegistrado ? "aporte_fic_sin_registrar" : "partida_sin_fuente";
  return control("EFECTIVO", null, { ...valores, resultado: "NO_CUADRA", codigoMotivo: motivo, detalle: { sinExplicar: txt(diferencia) } });
}

export function calcularConciliacion(e: EntradasConciliacion): Conciliado {
  const cantidades = e.especies.map(controlCantidad);
  const valores = e.especies.flatMap((x, i) => (x.certificada === null ? [] : [controlValor({ ...x, certificada: x.certificada }, cantidades[i]!.resultado)]));
  const pendientes = new Set(cantidades.filter((c) => c.resultado === "PENDIENTE_LIQUIDACION").map((c) => c.instrumentoId!));
  const controles = [...cantidades, ...valores, controlValorTotal(e.especies, pendientes, e.diaAnterior), ...e.fondos.map(controlFondo), controlEfectivo(e.efectivo)];
  const resultado = controles.some((c) => c.resultado === "NO_CUADRA") ? "NO_CUADRA" : controles.some((c) => c.resultado === "PENDIENTE_LIQUIDACION") ? "PARCIAL" : "CUADRA";
  return { resultado, controles };
}
