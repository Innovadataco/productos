/**
 * Dividendos atribuidos a un tramo de una decisión (fase B, corte 3; fecha ex del decreto desde la fase C, C5c). Puro.
 * La base guarda lo que pagó Trii (neto, por toda la tenencia), no el valor por acción. Por eso el valor por acción se
 * deriva: por acción = montoNeto / tenencia que lo cobró;  atribuido = montoNeto × cantidad / esa tenencia (4 decimales).
 * Entran los pagos con fecha en (base, objetivo] que no son la fracción de una escisión (esa es ganancia realizada).
 * Qué tenencia lo cobró y si le toca al tramo, por pago:
 *   - CON DECRETO: el pago va al grupo de decretos (los que cuentan de la especie con la misma fecha de pago) cuya ventana
 *     lo contiene, con la asignación del cruce (src/datos-oficiales/decretos/ventana.ts), hecha por pago: el veredicto de
 *     un pago no depende de qué otros pagos caen en el tramo. Manda la fecha ex que publicó la fuente: lo cobra la tenencia
 *     del cierre del día anterior a la ex (tenenciaAntesDeLaEx de tenencia.ts, la regla del cruce) y un tramo que empieza
 *     en la ex o después no lo cobra (se excluye: la compra de ese día no lo recibe y quien vende ese día sí lo recibió).
 *   - SIN DECRETO que alcance el pago: la aproximación de siempre. La tenencia del día del pago, que debe quedar quieta en
 *     los VENTANA_EX_DIAS anteriores (el periodo ex de la BVC está por verificar).
 * Cuando no se puede saber qué le tocaba a la cantidad medida, el tramo NO es medible y se dice por qué (gana el primer
 * motivo: los generales y después el del primer pago por fecha):
 *   - ESCISION_SIN_LOTE: la especie salió de una escisión sin su lote: la tenencia está incompleta.
 *   - CARGA_NO_CUBRE: el objetivo es posterior a la fecha de la última carga de Trii (órdenes y dividendos). Es una
 *     APROXIMACIÓN: se mide por cuándo se cargó, no por la última fecha que trae el archivo (Trii no la da aparte);
 *     un archivo exportado antes de cargarlo puede no traer un pago reciente.
 *   - SIN_TENENCIA: algún día de la ventana no hubo acciones (p. ej. se vendió todo): no se sabe qué pagó la especie.
 *   - TENENCIA_CAMBIA_CERCA_DEL_PAGO: sin decreto, hubo compras o ventas en los VENTANA_EX_DIAS anteriores a un pago.
 *   - DECRETO_EN_DUDA: el pago cabe en la ventana de dos grupos de decretos (la asignación sería una suposición) o llegó
 *     antes de alguna fecha ex de su grupo.
 *   - EX_DISTINTAS_EN_EL_PAGO: el grupo junta fechas ex distintas y el tramo empieza entre ellas o la tenencia cambia
 *     entre ellas: el neto no se puede repartir.
 * Mide decisiones pasadas; no recomienda nada.
 */
import { Prisma, type TipoDividendo } from "@prisma/client";
import { agruparPorFechaDePago, asignarPagos, type GrupoDePago } from "../datos-oficiales/decretos/ventana";
import { sumarDias } from "./fechas";
import { constanteEn, positivaEn, tenenciaAntesDeLaEx, tenenciaEn, type MovimientoTenencia } from "./tenencia";

/** Días calendario antes de un pago SIN decreto en que la tenencia debe quedar quieta (aproximación de la fecha ex). */
export const VENTANA_EX_DIAS = 10;
const DECIMALES_ATRIBUIDO = 4;
const DECIMALES_POR_ACCION = 6;

export type MotivoSinDividendos =
  | "ESCISION_SIN_LOTE"
  | "CARGA_NO_CUBRE"
  | "SIN_TENENCIA"
  | "TENENCIA_CAMBIA_CERCA_DEL_PAGO"
  | "DECRETO_EN_DUDA"
  | "EX_DISTINTAS_EN_EL_PAGO";

export interface DividendoPagado {
  readonly id: string;
  readonly fechaPago: Date;
  /** Lo que pagó Trii por toda la tenencia, neto de retención. */
  readonly montoNeto: Prisma.Decimal;
  readonly tipo: TipoDividendo;
}

/** Un decreto que cuenta de la especie (src/datos-oficiales/decretos/vigentes.ts): solo sus fechas. */
export interface DecretoDeLaEspecie {
  readonly fechaEx: Date;
  readonly fechaPago: Date;
}

/** Lo que se sabe de la especie para medir sus dividendos (lo arma `resultados-lote.ts`). */
export interface ContextoEspecie {
  readonly dividendos: readonly DividendoPagado[];
  readonly movimientos: readonly MovimientoTenencia[];
  /** El día (en Colombia) de la última carga de Trii de órdenes Y de dividendos, el menor de los dos; null si falta alguna. */
  readonly cubiertoHasta: Date | null;
  readonly destinoSinLote: boolean;
  /** Fechas de las escisiones en que la especie es el origen. */
  readonly escisiones: readonly Date[];
  /** Los decretos que cuentan, alrededor de los pagos. Sin el campo o vacío, todos los pagos van por la aproximación. */
  readonly decretos?: readonly DecretoDeLaEspecie[];
}

export interface DividendoAtribuido {
  readonly dividendoId: string;
  readonly fechaPago: Date;
  readonly montoNeto: Prisma.Decimal;
  /** La que lo cobró: la del cierre del día anterior a la ex con decreto; la del día del pago sin él. */
  readonly tenencia: bigint;
  readonly porAccion: Prisma.Decimal;
  /** Sin signo: el signo lo pone la acción de la decisión. */
  readonly atribuido: Prisma.Decimal;
}

export type DividendosTramo =
  | { readonly medible: true; readonly atribuidos: readonly DividendoAtribuido[]; readonly total: Prisma.Decimal }
  | { readonly medible: false; readonly motivo: MotivoSinDividendos };

/** Qué hace un pago en el tramo: lo cobra esa tenencia, no le toca, o no se sabe (con el motivo). */
type Derecho = { readonly cobra: bigint } | { readonly noLeToca: true } | ConMotivo;
interface ConMotivo {
  readonly motivo: MotivoSinDividendos;
}

type GrupoDeLaEspecie = GrupoDePago<DecretoDeLaEspecie & { readonly instrumentoId: string }>;

/** El contexto es de una sola especie; la ventana agrupa y asigna por especie. */
const ESPECIE = "especie";

function motivoGeneral(ctx: ContextoEspecie, base: Date, objetivo: Date): MotivoSinDividendos | null {
  if (ctx.destinoSinLote) return "ESCISION_SIN_LOTE";
  if (ctx.cubiertoHasta === null || objetivo > ctx.cubiertoHasta) return "CARGA_NO_CUBRE";
  return positivaEn(ctx.movimientos, base, objetivo) ? null : "SIN_TENENCIA";
}

/** Sin decreto: la tenencia del día del pago, quieta en los VENTANA_EX_DIAS anteriores. */
function derechoSinDecreto(fechaPago: Date, movimientos: readonly MovimientoTenencia[]): Derecho {
  if (!constanteEn(movimientos, sumarDias(fechaPago, -VENTANA_EX_DIAS), fechaPago)) return { motivo: "TENENCIA_CAMBIA_CERCA_DEL_PAGO" };
  return { cobra: tenenciaEn(movimientos, fechaPago) };
}

/**
 * Con su grupo de decretos (ya sin disputa): con pago ≥ la última ex, todo «día anterior a la ex» cae en [base, objetivo),
 * donde la tenencia es positiva (motivoGeneral), así que el divisor nunca es cero.
 */
function derechoConDecreto(fechaPago: Date, grupo: GrupoDeLaEspecie, movimientos: readonly MovimientoTenencia[], base: Date): Derecho {
  const exs = grupo.decretos.map((d) => d.fechaEx.getTime());
  const exMin = new Date(Math.min(...exs));
  const exMax = new Date(Math.max(...exs));
  if (fechaPago < exMax) return { motivo: "DECRETO_EN_DUDA" };
  if (base >= exMax) return { noLeToca: true };
  if (base >= exMin || !constanteEn(movimientos, sumarDias(exMin, -1), sumarDias(exMax, -1))) return { motivo: "EX_DISTINTAS_EN_EL_PAGO" };
  return { cobra: tenenciaAntesDeLaEx(movimientos, exMin) };
}

function derechoDe(d: DividendoPagado, grupos: readonly GrupoDeLaEspecie[], movimientos: readonly MovimientoTenencia[], base: Date): Derecho {
  const { porGrupo, enDisputa } = asignarPagos(grupos, [{ instrumentoId: ESPECIE, fechaPago: d.fechaPago }]);
  if (enDisputa.size > 0) return { motivo: "DECRETO_EN_DUDA" };
  const grupo = grupos.find((g) => porGrupo.has(g.clave));
  return grupo ? derechoConDecreto(d.fechaPago, grupo, movimientos, base) : derechoSinDecreto(d.fechaPago, movimientos);
}

function atribuir(d: DividendoPagado, tenencia: bigint, cantidad: bigint): DividendoAtribuido {
  const t = tenencia.toString();
  return {
    dividendoId: d.id,
    fechaPago: d.fechaPago,
    montoNeto: d.montoNeto,
    tenencia,
    porAccion: d.montoNeto.div(t).toDecimalPlaces(DECIMALES_POR_ACCION, Prisma.Decimal.ROUND_HALF_UP),
    atribuido: d.montoNeto.mul(cantidad.toString()).div(t).toDecimalPlaces(DECIMALES_ATRIBUIDO, Prisma.Decimal.ROUND_HALF_UP),
  };
}

const conMotivo = <T extends { readonly derecho: Derecho }>(x: T): x is T & { readonly derecho: ConMotivo } => "motivo" in x.derecho;

export function dividendosDelTramo(ctx: ContextoEspecie, base: Date, objetivo: Date, cantidad: bigint): DividendosTramo {
  const general = motivoGeneral(ctx, base, objetivo);
  if (general) return { medible: false, motivo: general };
  const grupos = agruparPorFechaDePago((ctx.decretos ?? []).map((dc) => ({ ...dc, instrumentoId: ESPECIE })));
  const pagos = ctx.dividendos
    .filter((d) => d.tipo !== "FRACCION_ESCISION" && d.fechaPago > base && d.fechaPago <= objetivo)
    .sort((a, b) => a.fechaPago.getTime() - b.fechaPago.getTime() || (a.id < b.id ? -1 : 1))
    .map((d) => ({ d, derecho: derechoDe(d, grupos, ctx.movimientos, base) }));
  const primero = pagos.find(conMotivo);
  if (primero) return { medible: false, motivo: primero.derecho.motivo };
  const atribuidos = pagos.flatMap(({ d, derecho }) => ("cobra" in derecho ? [atribuir(d, derecho.cobra, cantidad)] : []));
  return { medible: true, atribuidos, total: atribuidos.reduce((s, a) => s.add(a.atribuido), new Prisma.Decimal(0)) };
}
