/**
 * La presentación es-CO de un hecho: UNA cadena por unidad, con los formatos deterministas de la pantalla
 * (src/app/tablero/formato.ts, sin modificarlos). Es la única fuente de `presentacion`: `construirPaquete` exige
 * `presentacion === presentar(valor, unidad)` (PRESENTACION_NO_COINCIDE). Así el número que el código pone en el texto
 * sale del valor fuente calculado, nunca de lo que repita un modelo (condición 2 de PI desde el origen).
 *
 * Por unidad (nunca con «+»: la dirección va aparte, en el hecho):
 * - PESOS: `cop`, redondeado al peso, como el tablero («$ 37.911», «−$ 1.238»).
 * - PESOS_POR_DOLAR: dos decimales, con el signo delante del «$» («$ 4.613,27»).
 * - PORCENTAJE: un decimal, sin «+» («12,4 %», «−2,5 %»), como el peso de una especie en el tablero.
 * - DIAS y MESES: el entero con su palabra, en singular solo con 1 («1 día», «190 días», «3 meses»).
 * - ESPECIES: el entero solo («7»). FECHA: `fecha` («16-mar-2027»). NOMBRE: el nombre tal cual.
 * Lo que la pantalla no puede pintar (|valor| ≥ 10^21) sale «—», como allí; el paquete lo rechaza (sin cifra).
 *
 * Límite conocido (decisión pendiente de la Fábrica): al ser por unidad, un nivel de 9,5 sale «$ 10» y una tasa de
 * 9,25 sale «9,3 %», aunque la pantalla del plan y la de datos oficiales los pinten sin redondear.
 */
import { cop, fecha, numero } from "../app/tablero/formato";
import { UNIDADES, type Unidad } from "./contrato";
import { esDe, esDecimalCanonico, esDiaIso, esNombreEspecie } from "./formas";

const SIN_DATO = "—";
const MENOS = "−";
const ENTERO = /^-?[0-9]+$/;
const UNIDADES_ENTERAS: ReadonlySet<Unidad> = new Set<Unidad>(["DIAS", "MESES", "ESPECIES"]);
const DECIMALES_DOLAR = 2;
const DECIMALES_PORCENTAJE = 1;

/** El valor tiene la forma de su unidad (la misma regla que aplica `construirPaquete` antes de presentar). */
function tieneForma(valor: unknown, unidad: Unidad): valor is string {
  if (unidad === "NOMBRE") return esNombreEspecie(valor);
  if (typeof valor !== "string") return false;
  if (unidad === "FECHA") return esDiaIso(valor);
  return esDecimalCanonico(valor) && (!UNIDADES_ENTERAS.has(unidad) || ENTERO.test(valor));
}

/** «N día» o «N días»: la palabra va en singular solo si el entero es 1 o −1. */
function conPalabra(entero: number, singular: string, plural: string): string {
  const cifra = numero(entero);
  if (cifra === SIN_DATO) return SIN_DATO;
  return `${cifra} ${Math.abs(entero) === 1 ? singular : plural}`;
}

/** Dos decimales con el signo delante del «$», como `cop`. */
function pesosPorDolar(v: number): string {
  const cifra = numero(v, DECIMALES_DOLAR);
  if (cifra === SIN_DATO) return SIN_DATO;
  return cifra.startsWith(MENOS) ? `${MENOS}$ ${cifra.slice(MENOS.length)}` : `$ ${cifra}`;
}

function porcentaje(v: number): string {
  const cifra = numero(v, DECIMALES_PORCENTAJE);
  return cifra === SIN_DATO ? SIN_DATO : `${cifra} %`;
}

/**
 * La cadena es-CO del valor en su unidad. Lanza TypeError (sin repetir el valor) si la unidad no es del contrato o el
 * valor no tiene su forma: decimal canónico (entero en DIAS, MESES y ESPECIES), día ISO o nombre de especie.
 */
export function presentar(valor: string, unidad: Unidad): string {
  if (!esDe(UNIDADES, unidad)) throw new TypeError("Unidad fuera del contrato de hechos.");
  if (!tieneForma(valor, unidad)) throw new TypeError("El valor no tiene la forma de su unidad.");
  switch (unidad) {
    case "NOMBRE":
      return valor;
    case "FECHA":
      return fecha(valor);
    case "PESOS":
      return cop(Number(valor));
    case "PESOS_POR_DOLAR":
      return pesosPorDolar(Number(valor));
    case "PORCENTAJE":
      return porcentaje(Number(valor));
    case "DIAS":
      return conPalabra(Number(valor), "día", "días");
    case "MESES":
      return conPalabra(Number(valor), "mes", "meses");
    case "ESPECIES":
      return numero(Number(valor));
  }
}
