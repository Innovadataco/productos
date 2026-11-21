/**
 * Cálculo puro del tablero (INV-SPEC-15). Sin base de datos y en Decimal: las cifras de la
 * pantalla salen de aquí y cuadran entre sí por construcción.
 *   ganancia total = sin vender + por ventas (incluye fracciones de escisión) + dividendos − comisiones
 */
import { Prisma } from "@prisma/client";

type Decimal = Prisma.Decimal;
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const CERO = D(0);

export interface EntradaEspecie {
  readonly instrumentoId: string;
  readonly nemotecnico: string;
  readonly cantidad: bigint; // viva (0 si se vendió toda)
  readonly costoVivo: Decimal; // costo de lo que queda, sin comisiones
  readonly cierre: { readonly precio: Decimal; readonly fecha: Date; readonly verificado: boolean } | null;
  readonly realizada: Decimal; // ventas − costo FIFO + fracciones de escisión
  readonly dividendos: Decimal; // netos, sin fracciones
  readonly comisiones: Decimal; // de compras y ventas aprobadas
  readonly lotesVivos: number;
  readonly serie: readonly { readonly fecha: Date; readonly precio: Decimal }[];
}

export interface FilaTablero {
  readonly instrumentoId: string;
  readonly nemotecnico: string;
  readonly cantidad: bigint;
  readonly costoVivo: Decimal;
  readonly valor: Decimal | null; // null si no hay cierre
  readonly sinVender: Decimal | null;
  readonly rentabilidadPct: Decimal | null; // sin vender / costo vivo
  readonly pesoPct: Decimal | null; // valor / valor de las acciones
  readonly realizada: Decimal;
  readonly dividendos: Decimal;
  readonly comisiones: Decimal;
  readonly cierre: EntradaEspecie["cierre"];
  readonly lotesVivos: number;
  readonly serie: EntradaEspecie["serie"];
}

export interface Tablero {
  readonly filas: FilaTablero[]; // vivas, ordenadas por valor
  readonly cerradas: FilaTablero[]; // vendidas por completo (aportan ganancia por ventas o dividendos)
  readonly valorAcciones: Decimal;
  readonly sinVender: Decimal;
  readonly porVentas: Decimal;
  readonly dividendos: Decimal;
  readonly comisiones: Decimal;
  readonly gananciaTotal: Decimal;
  readonly especiesSinPrecio: number;
}

const suma = (xs: readonly Decimal[]) => xs.reduce((s, x) => s.add(x), CERO);

export function calcularTablero(entradas: readonly EntradaEspecie[]): Tablero {
  const base = entradas.map((e) => {
    const valor = e.cantidad > 0n && e.cierre ? e.cierre.precio.mul(e.cantidad.toString()) : e.cantidad > 0n ? null : CERO;
    const sinVender = valor === null ? null : valor.sub(e.costoVivo);
    const rentabilidadPct = sinVender !== null && e.costoVivo.gt(0) ? sinVender.div(e.costoVivo).mul(100) : null;
    return { ...e, valor, sinVender, rentabilidadPct };
  });
  const vivas = base.filter((f) => f.cantidad > 0n);
  const valorAcciones = suma(vivas.map((f) => f.valor ?? CERO));
  const conPeso = (f: (typeof base)[number]): FilaTablero => ({
    instrumentoId: f.instrumentoId, nemotecnico: f.nemotecnico, cantidad: f.cantidad, costoVivo: f.costoVivo,
    valor: f.valor, sinVender: f.sinVender, rentabilidadPct: f.rentabilidadPct,
    pesoPct: f.valor !== null && valorAcciones.gt(0) && f.cantidad > 0n ? f.valor.div(valorAcciones).mul(100) : null,
    realizada: f.realizada, dividendos: f.dividendos, comisiones: f.comisiones, cierre: f.cierre, lotesVivos: f.lotesVivos, serie: f.serie,
  });
  const filas = vivas.map(conPeso).sort((a, b) => (b.valor ?? CERO).cmp(a.valor ?? CERO));
  const cerradas = base.filter((f) => f.cantidad === 0n).map(conPeso).sort((a, b) => a.nemotecnico.localeCompare(b.nemotecnico));
  const todas = [...filas, ...cerradas];
  const sinVender = suma(todas.map((f) => f.sinVender ?? CERO));
  const porVentas = suma(todas.map((f) => f.realizada));
  const dividendos = suma(todas.map((f) => f.dividendos));
  const comisiones = suma(todas.map((f) => f.comisiones));
  return {
    filas, cerradas, valorAcciones, sinVender, porVentas, dividendos, comisiones,
    gananciaTotal: sinVender.add(porVentas).add(dividendos).sub(comisiones),
    especiesSinPrecio: filas.filter((f) => f.valor === null).length,
  };
}
