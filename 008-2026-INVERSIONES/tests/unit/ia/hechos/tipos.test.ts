/**
 * Candados de TIPOS de los armadores: lo que el compilador debe rechazar. Cada `@ts-expect-error` es una prueba: si el
 * tipo deja de rechazar el caso, `npm run typecheck` da «Unused '@ts-expect-error' directive» y se pone en rojo. Las
 * funciones no se ejecutan (solo se compilan); el caso de ejecución de cada una está en su prueba.
 */
import { describe, expect, it } from "vitest";
import { borrador, marcasDeHoy, type Marcas } from "@/ia/hechos/comun";
import type { FondoParaHechos } from "@/ia/hechos";
import { D, HOY, dia } from "./apoyo.ficticio";

const marcas = marcasDeHoy(HOY, "PLAN");

/** Solo se compila. */
function casosDeTipos(): void {
  const especie = borrador("ESPECIE_NOMBRE", "FICTICIA-ALFA", "fuente-ficticia", marcas);
  const ancla = borrador("REGLA_DEL_PLAN", "2027-02-03", "fuente-ficticia", marcas, { sujeto: especie });
  borrador("REGLA_NIVEL", "4591.37", "fuente-ficticia", marcas, { sujeto: ancla });
  borrador("VALOR_ESPECIE", "4613.27", "fuente-ficticia", marcas, { sujeto: especie });

  // @ts-expect-error: un hecho de regla cita a su ancla, no directo a la especie (lo arma así el armador)
  borrador("REGLA_NIVEL", "4591.37", "fuente-ficticia", marcas, { sujeto: especie });
  // @ts-expect-error: el ancla cita a la especie, nunca a otra ancla
  borrador("REGLA_DEL_PLAN", "2027-02-03", "fuente-ficticia", marcas, { sujeto: ancla });
  // @ts-expect-error: un hecho que no es de regla no cita a un ancla
  borrador("PROXIMO_EX_DIVIDENDO", "2027-04-07", "fuente-ficticia", marcas, { sujeto: ancla });
  // @ts-expect-error: el sujeto es el borrador, no un texto
  borrador("VALOR_ESPECIE", "4613.27", "fuente-ficticia", marcas, { sujeto: "especie" });
  // @ts-expect-error: el nombre de la especie no tiene sujeto
  borrador("ESPECIE_NOMBRE", "FICTICIA-BETA", "fuente-ficticia", marcas, { sujeto: especie });

  // @ts-expect-error: las marcas solo salen de sus constructores (fecha y frescura no se pueden contradecir a mano)
  const aMano: Marcas = { fecha: "2027-03-16", frescura: "HOY", origen: "PLAN" };

  // @ts-expect-error: un número no es un decimal (su toFixed() redondearía al entero)
  const fondo: FondoParaHechos = { valorUnidad: 13711.293847, valorUnidadAnterior: null, fecha: dia(HOY), atrasado: false, valor: null };
  const conDecimal: FondoParaHechos = { valorUnidad: D("13711.293847"), valorUnidadAnterior: null, fecha: dia(HOY), atrasado: false, valor: null };
  void [aMano, fondo, conDecimal];
}

describe("candados de tipos de los armadores", () => {
  it("compilan los casos válidos y el compilador rechaza los inválidos (los vigila npm run typecheck)", () => {
    expect(typeof casosDeTipos).toBe("function");
  });
});
