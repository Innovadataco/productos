/**
 * Riesgo del portafolio en la ventana común: `armarHistoria` (src/proyecciones/historia.ts) con las acciones que tienen
 * valor en el tablero. Puro.
 * - Retornos diarios de PRECIO (factores − 1, ajustados). Sin dividendos: en datos diarios el pago y el salto ex caen en
 *   días distintos y sumarlos inflaría la varianza.
 * - Pesos: el valor del tablero de cada especie cubierta sobre el de todas las cubiertas (renormalizados), con la fracción
 *   cubierta del valor de las acciones. Las que no entran en la ventana quedan SIN_HISTORIA: no se inventa su riesgo.
 * - Anualización: A = 12 × ruedasPorMes de la ventana común, el factor de `volatilidadAnualVentana` de las proyecciones.
 *   Esa otra volatilidad usa retornos logarítmicos del portafolio y los pesos de Yahoo: los dos números no coinciden.
 */
import type { Prisma } from "@prisma/client";
import type { AvisoCrudo, EntradasProyeccion } from "../proyecciones/tipos";
import type { RiesgoEspecie, RiesgoPortafolio } from "./tipos";

export interface EspecieCubierta {
  readonly instrumentoId: string;
  /** Positivo. */
  readonly valor: Prisma.Decimal;
}

export interface ResultadoRiesgoComun {
  readonly portafolio: RiesgoPortafolio;
  /** Por id, de cada especie pedida. */
  readonly porEspecie: ReadonlyMap<string, RiesgoEspecie>;
  readonly avisos: readonly AvisoCrudo[];
}

/** `especies`: las de valor positivo del tablero; `valorAcciones`: el total del tablero. */
export function riesgoComun(e: EntradasProyeccion, especies: readonly EspecieCubierta[], valorAcciones: Prisma.Decimal): ResultadoRiesgoComun {
  throw new Error("sin implementar");
}
