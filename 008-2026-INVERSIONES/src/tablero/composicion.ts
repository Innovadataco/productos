/**
 * Composición del portafolio en acciones (frente graficas-tablero): una tajada por especie viva con valor, de mayor a
 * menor. Con más de 8, las 7 de mayor valor y «Otras» con la suma de las demás (nunca un noveno color). Cálculo puro
 * y en Decimal: el peso de «Otras» es la suma exacta de los pesos del tablero.
 */
import { Prisma } from "@prisma/client";
import type { FilaTablero } from "./calculo";

type Decimal = Prisma.Decimal;
const CERO = new Prisma.Decimal(0);

export const MAX_TAJADAS = 8;
export const ID_OTRAS = "otras";

export interface Tajada {
  readonly id: string;
  readonly nemo: string;
  readonly valor: Decimal;
  readonly pesoPct: Decimal;
  /** Solo en «Otras»: los nemotécnicos que junta, de mayor a menor valor. */
  readonly miembros: readonly string[];
}

export function componer(filas: readonly FilaTablero[]): Tajada[] {
  const conValor = filas
    .filter((f): f is FilaTablero & { valor: Decimal; pesoPct: Decimal } => f.valor !== null && f.pesoPct !== null && f.valor.gt(0))
    .sort((a, b) => b.valor.cmp(a.valor) || (a.nemotecnico < b.nemotecnico ? -1 : 1));
  const tajadas = conValor.map((f): Tajada => ({ id: f.instrumentoId, nemo: f.nemotecnico, valor: f.valor, pesoPct: f.pesoPct, miembros: [] }));
  if (tajadas.length <= MAX_TAJADAS) return tajadas;
  const propias = tajadas.slice(0, MAX_TAJADAS - 1);
  const resto = tajadas.slice(MAX_TAJADAS - 1);
  const otras: Tajada = {
    id: ID_OTRAS, nemo: "Otras",
    valor: resto.reduce((s, t) => s.add(t.valor), CERO),
    pesoPct: resto.reduce((s, t) => s.add(t.pesoPct), CERO),
    miembros: resto.map((t) => t.nemo),
  };
  return [...propias, otras];
}
