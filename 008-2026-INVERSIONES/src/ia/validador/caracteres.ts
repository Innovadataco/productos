/** Esqueleto (rojo): lista blanca de caracteres y forma de la frase. */
import type { CodigoValidador } from "./codigos";

export interface HallazgoDeFrase {
  readonly codigo: CodigoValidador;
  readonly patron: string;
}
export function revisarCaracteres(_texto: string): readonly HallazgoDeFrase[] {
  throw new Error("SIN_IMPLEMENTAR");
}
