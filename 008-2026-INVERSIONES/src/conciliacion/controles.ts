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
 * Resultado global: CUADRA si todo cuadra; PARCIAL si lo único pendiente es T+2; NO_CUADRA en otro caso.
 */
import { Prisma } from "@prisma/client";

export const VERSION_CALCULO = "conciliacion-v1";
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

const precioDistinto = (e: EspecieEntrada) =>
  e.certificada !== null && e.cierre !== null && !dentroRelativo(D(e.cierre), D(e.certificada.precioValoracion));

function controlValor(e: EspecieEntrada & { certificada: NonNullable<EspecieEntrada["certificada"]> }, cantidadCuadra: boolean): Control {
  const real = D(e.certificada.valorMercado);
  const base = { real: txt(real), tolerancia: TOLERANCIA_VALOR };
  if (e.cierre === null) return control("VALOR", e.instrumentoId, { ...base, resultado: "NO_CUADRA", codigoMotivo: "sin_precio_al_corte" });
  const esperado = D(e.cierre).mul(e.liquidada.toString());
  const valores = { ...base, esperado: txt(esperado), diferencia: txt(real.sub(esperado)) };
  if (dentroRelativo(esperado, real)) return control("VALOR", e.instrumentoId, valores);
  if (!cantidadCuadra) return control("VALOR", e.instrumentoId, { ...valores, resultado: "NO_CUADRA", codigoMotivo: "por_cantidad" });
  const motivo = precioDistinto(e) ? "precio_distinto" : "diferencia_valor";
  return control("VALOR", e.instrumentoId, { ...valores, resultado: "NO_CUADRA", codigoMotivo: motivo, detalle: { cierre: e.cierre, precioValoracion: e.certificada.precioValoracion } });
}

function controlValorTotal(especies: readonly EspecieEntrada[]): Control {
  const certificadas = especies.filter((e) => e.certificada !== null);
  const real = certificadas.reduce((s, e) => s.add(e.certificada!.valorMercado), D(0));
  const base = { real: txt(real), tolerancia: TOLERANCIA_VALOR, detalle: { alcance: "total_acciones" } };
  if (certificadas.some((e) => e.cierre === null)) return control("VALOR", null, { ...base, resultado: "NO_CUADRA", codigoMotivo: "sin_precio_al_corte" });
  const esperado = certificadas.reduce((s, e) => s.add(D(e.cierre!).mul(e.liquidada.toString())), D(0));
  const valores = { ...base, esperado: txt(esperado), diferencia: txt(real.sub(esperado)) };
  if (dentroRelativo(esperado, real)) return control("VALOR", null, valores);
  const dudosa = certificadas.length >= 2 && certificadas.every(precioDistinto);
  return control("VALOR", null, { ...valores, resultado: "NO_CUADRA", codigoMotivo: dudosa ? "fecha_corte_dudosa" : "por_especies" });
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
  const valores = e.especies.flatMap((x, i) => (x.certificada === null ? [] : [controlValor({ ...x, certificada: x.certificada }, cantidades[i]!.resultado === "CUADRA")]));
  const controles = [...cantidades, ...valores, controlValorTotal(e.especies), ...e.fondos.map(controlFondo), controlEfectivo(e.efectivo)];
  const resultado = controles.some((c) => c.resultado === "NO_CUADRA") ? "NO_CUADRA" : controles.some((c) => c.resultado === "PENDIENTE_LIQUIDACION") ? "PARCIAL" : "CUADRA";
  return { resultado, controles };
}
