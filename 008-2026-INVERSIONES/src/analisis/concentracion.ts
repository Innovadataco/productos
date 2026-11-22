/**
 * Concentración del portafolio en acciones: la primera especie, las tres primeras y el índice de Herfindahl-Hirschman
 * (Σ peso²). Los pesos salen en Decimal del valor del tablero y se redondean al final. Puro.
 */
import { Prisma } from "@prisma/client";
import { compararTexto, redondear } from "./numeros";
import type { Concentracion } from "./tipos";

const TRES = 3;

export interface ValorEspecie {
  readonly instrumentoId: string;
  readonly valor: Prisma.Decimal | null;
}

type ConValor = ValorEspecie & { readonly valor: Prisma.Decimal };

/** De mayor a menor valor; en un empate, por id. */
export const porValor = (a: ConValor, b: ConValor): number => b.valor.cmp(a.valor) || compararTexto(a.instrumentoId, b.instrumentoId);

/** Solo cuentan las especies con valor positivo; null si no hay ninguna. En un empate de valor, por id. */
export function concentracionDe(especies: readonly ValorEspecie[]): Concentracion | null {
  if (especies.some((e) => e.valor?.isNegative())) throw new RangeError("Un valor del tablero no puede ser negativo.");
  const con = especies.filter((e): e is ConValor => e.valor !== null && e.valor.gt(0)).sort(porValor);
  if (con.length === 0) return null;
  const total = con.reduce((s, e) => s.add(e.valor), new Prisma.Decimal(0));
  const pesos = con.map((e) => e.valor.div(total));
  const hhi = pesos.reduce((s, w) => s.add(w.mul(w)), new Prisma.Decimal(0));
  const tres = con.slice(0, TRES);
  return {
    especies: con.length,
    primera: { instrumentoId: con[0]!.instrumentoId, peso: redondear(pesos[0]!.toNumber()) },
    tresPrimeras: { instrumentoIds: tres.map((e) => e.instrumentoId), peso: redondear(pesos.slice(0, TRES).reduce((s, w) => s.add(w), new Prisma.Decimal(0)).toNumber()) },
    hhi: redondear(hhi.toNumber()),
  };
}
