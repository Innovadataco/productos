/**
 * ETIQUETA.SIN_CITA (validador v3): si una cláusula nombra la ETIQUETA de un hecho del paquete (de los obligatorios o de
 * los que tienen dirección) sin su cita `{Hnn}`, se rechaza con ETIQUETA_NO_COINCIDE. Sin esto, «y la ganancia total
 * subió» se atribuía a otro dato y un DIARIO podía publicar una dirección falsa. Datos inventados.
 */
import { describe, expect, it } from "vitest";
import type { PaqueteHechos } from "@/ia/contrato";
import { armarDiario } from "@/ia/hechos";
import { validarSalida } from "@/ia/validador/validar";
import { entradaDiarioFicticia } from "../hechos/apoyo.ficticio";
import { paqueteFicticio, salidaDe } from "./apoyo/salidas.ficticio";

const p = paqueteFicticio("DIARIO");
const patrones = (cruda: string, paquete: PaqueteHechos = p): readonly string[] => {
  const r = validarSalida(cruda, paquete);
  return r.ok ? [] : r.hallazgos.map((h) => h.patron);
};
const SIN_CITA = "ETIQUETA.SIN_CITA";
const ESPECIE = "{ESPECIE_NOMBRE}: el valor de la especie es {VALOR_ESPECIE}";

describe("la etiqueta de un hecho sin su cita", () => {
  it("«y la ganancia total subió» sin citarla (con la ganancia total en baja) se rechaza", () => {
    const cruda = salidaDe(p, `${ESPECIE}, y la ganancia total subió.`);
    const r = validarSalida(cruda, p);
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : r.motivos).toContain("ETIQUETA_NO_COINCIDE");
    expect(patrones(cruda)).toContain(SIN_CITA);
  });

  it("control: la misma frase con su cita y la dirección correcta pasa", () => {
    const r = validarSalida(salidaDe(p, `${ESPECIE}, y la ganancia total bajó a {GANANCIA_TOTAL}.`), p);
    expect(r.ok, r.ok ? "" : r.motivos.join(",")).toBe(true);
  });

  it("control: con su cita pero la dirección contraria sigue siendo DIRECCION_CONTRADICE", () => {
    expect(patrones(salidaDe(p, `${ESPECIE}, y la ganancia total subió a {GANANCIA_TOTAL}.`))).toContain("DIRECCION.SUBE_VERBO");
  });

  it("también la etiqueta de un obligatorio que el código escribiría (el valor de las acciones)", () => {
    expect(patrones(salidaDe(p, `${ESPECIE}, frente al valor de las acciones.`))).toContain(SIN_CITA);
  });

  it("la cita en OTRA cláusula no vale: «y» separa cláusulas", () => {
    expect(patrones(salidaDe(p, `La ganancia total es mayor y ${ESPECIE}, y la ganancia total bajó a {GANANCIA_TOTAL}.`))).toContain(SIN_CITA);
  });

  it("una etiqueta de un hecho sin dirección y no obligatorio no se exige (la fecha del cierre)", () => {
    expect(patrones(salidaDe(p, `${ESPECIE}, en la fecha del cierre más reciente.`))).not.toContain(SIN_CITA);
  });

  it("una etiqueta contenida en otra más larga citada no cuenta (valor de las acciones dentro de la variación del día)", () => {
    const diario = armarDiario(entradaDiarioFicticia());
    const cruda = salidaDe(diario, "Los dividendos recibidos son {DIVIDENDOS_RECIBIDOS}, y la variación del día del valor de las acciones es {VARIACION_DIA_VALOR}.");
    expect(patrones(cruda, diario)).not.toContain(SIN_CITA);
  });

  it("REGLAS y ESCENARIOS también (la regla es del validador, no del DIARIO)", () => {
    const reglas = paqueteFicticio("REGLAS");
    const cruda = salidaDe(reglas, "{ESPECIE_NOMBRE}: la distancia al nivel de la regla es cerca y el nivel de la regla es lejos.");
    expect(patrones(cruda, reglas)).toContain(SIN_CITA);
  });
});
