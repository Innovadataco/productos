// R6 · los cambios de rango de la operación simulada (paso 1 del «Para revisar»): del análisis de antes y de después, de
// la probabilidad de los escenarios y de las reglas del plan con el precio límite; y su paso a la vista. Datos inventados.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { analizar } from "@/analisis/analizar";
import { cambiosDeLaOperacion } from "@/analisis/puntos/simulacion";
import { VERSION_PUNTOS } from "@/analisis/puntos/tipos";
import { compararAnalisis } from "@/operar/analisis/comparar";
import { portafolioDespues } from "@/operar/analisis/despues";
import { aVistaAnalisis } from "@/operar/analisis/vista";
import { analisis as analisisFicticio, cubierta, especie as especieFicticia, sinValor } from "../../analisis/fixtures/analisis.ficticio";
import { diasHabiles, portafolio, retornosRepetidos, serieDeRetornos, type EspecieFicticia } from "../../analisis/fixtures/portafolio.ficticio";
import { prohibidasEn } from "../informe/lenguaje";

const DIAS = diasHabiles("2019-01-02", 300);
const especie = (id: string, cantidad: number, inicial: number, escala: number): EspecieFicticia => ({
  id, cantidad, cierres: serieDeRetornos(DIAS, inicial, retornosRepetidos(DIAS.length - 1, escala)),
});
const ENTRADAS = portafolio([especie("FICTICIA-A", 37, 1237.4, 1), especie("FICTICIA-B", 3, 4613.27, 2.3), especie("FICTICIA-C", 23, 905.61, 1.7)]);
const D = (x: string) => new Prisma.Decimal(x);
const NOMBRES = new Map([["FICTICIA-A", "FICTICIA-A"], ["FICTICIA-B", "FICTICIA-B"], ["FICTICIA-C", "FICTICIA-C"]]);

function simular(cantidadDespues: bigint, extra: Partial<Parameters<typeof cambiosDeLaOperacion>[0]> = {}) {
  const antes = analizar(ENTRADAS);
  const despues = analizar({ ...ENTRADAS, ...portafolioDespues(ENTRADAS, "FICTICIA-B", cantidadDespues) });
  return { antes, despues, cambios: cambiosDeLaOperacion({ antes, despues, probabilidad: null, reglas: [], instrumentoId: "FICTICIA-B", precioLimite: D("4600"), hoy: ENTRADAS.hoy, ...extra }) };
}

describe("cambiosDeLaOperacion", () => {
  it("comprar mucho de FICTICIA-B deja primero el peso que pasa a muy elevado", () => {
    const { antes, despues, cambios } = simular(60n);
    expect(antes.especies.find((e) => e.instrumentoId === "FICTICIA-B")!.peso!).toBeGreaterThan(0.25);
    expect(antes.especies.find((e) => e.instrumentoId === "FICTICIA-B")!.peso!).toBeLessThanOrEqual(0.4);
    expect(despues.especies.find((e) => e.instrumentoId === "FICTICIA-B")!.peso!).toBeGreaterThan(0.4);
    expect(cambios[0]).toMatchObject({ clave: "PESO_ESPECIE", cambio: "SUBE", importancia: "ALTA", despues: { rango: "MUY_ELEVADO" } });
    const vista = aVistaAnalisis({
      comparacion: compararAnalisis({ antes, despues, puntosAntes: [], puntosDespues: [], instrumentoId: "FICTICIA-B" }),
      escenarios: null, nombres: NOMBRES, operadaId: "FICTICIA-B", lado: "COMPRAR", plan: null, caja: "ESCRITA", cambios,
    });
    expect(vista.paraRevisar[0]).toMatchObject({ importancia: "Importancia alta", frase: "El peso de «FICTICIA-B» pasa de elevado a muy elevado" });
    expect(prohibidasEn(vista.paraRevisar.flatMap((i) => [i.frase, i.nota]).join(" "))).toEqual([]);
  });
  it("si la operación no cambia ningún rango, no hay cambios", () => {
    expect(simular(3n).cambios).toEqual([]);
  });
  it("vender todo hace desaparecer el punto de la especie", () => {
    const { cambios } = simular(0n);
    expect(cambios.some((c) => c.sujeto.tipo === "ESPECIE" && c.sujeto.instrumentoId === "FICTICIA-B" && c.cambio === "DESAPARECE")).toBe(true);
  });
  it("la probabilidad de los escenarios entra en los dos lados; sin escenarios no hay punto", () => {
    const con = simular(3n, { probabilidad: { antes: 0.05, despues: 0.3 } }).cambios;
    expect(con).toEqual([expect.objectContaining({ clave: "PROBABILIDAD_BAJO_APORTADO", cambio: "APARECE", importancia: "MEDIA" })]);
    expect(simular(3n, { probabilidad: null }).cambios.filter((c) => c.clave === "PROBABILIDAD_BAJO_APORTADO")).toEqual([]);
  });
  it("una regla de nivel se mide con el precio límite de la orden", () => {
    const regla = { id: "R1", instrumentoId: "FICTICIA-B", condicion: "CIERRE_BAJO" as const, nivel: D("4650"), plazoHasta: null };
    const [c] = simular(3n, { reglas: [regla], precioLimite: D("4600") }).cambios;
    expect(c).toMatchObject({ clave: "REGLA_TOCADA", cambio: "APARECE", importancia: "ALTA", sujeto: { tipo: "ORDEN", reglaId: "R1", instrumentoId: "FICTICIA-B" } });
    expect(simular(3n, { reglas: [regla], precioLimite: D("4700") }).cambios).toEqual([expect.objectContaining({ clave: "REGLA_DISTANCIA" })]);
  });
  it("es JSON puro y la versión es puntos-v1", () => {
    const { cambios } = simular(60n);
    expect(JSON.parse(JSON.stringify(cambios))).toEqual(cambios);
    expect(VERSION_PUNTOS).toBe("puntos-v1");
  });
  it("si el después pierde la cobertura o el valor de una especie, no hay falsos «desaparece»", () => {
    const antes = analisisFicticio({
      especies: [especieFicticia("FICTICIA-A", { peso: 0.3, riesgo: cubierta(0.3, 0.9), efectoCaida: { pesos: D("-1"), fraccionPortafolio: -0.12 } }), especieFicticia("FICTICIA-B", { peso: 0.2 })],
    });
    const despues = analisisFicticio({
      especies: [
        especieFicticia("FICTICIA-A", { peso: 0.3, riesgo: { estado: "SIN_HISTORIA", motivo: "HISTORIA_CORTA_EN_VENTANA", dias: 10 }, efectoCaida: null }),
        sinValor("FICTICIA-B"),
      ],
    });
    const entrada = { antes, despues, probabilidad: null, reglas: [], instrumentoId: "FICTICIA-A", precioLimite: D("100"), hoy: ENTRADAS.hoy };
    expect(cambiosDeLaOperacion(entrada)).toEqual([]);
    // Control positivo: con el riesgo y el efecto calculados en el después, el punto sí desaparece.
    const calculado = analisisFicticio({ especies: [especieFicticia("FICTICIA-A", { peso: 0.3, riesgo: cubierta(0.3, 0.1), efectoCaida: { pesos: D("-1"), fraccionPortafolio: -0.01 } }), especieFicticia("FICTICIA-B", { peso: 0.2 })] });
    expect(cambiosDeLaOperacion({ ...entrada, despues: calculado }).map((c) => c.clave).sort()).toEqual(["PUNTO_CONTRIBUCION_RIESGO", "PUNTO_EFECTO_CAIDA"]);
  });
  it("sin escenarios, la probabilidad tampoco desaparece ni aparece", () => {
    const x = analisisFicticio({ especies: [] });
    expect(cambiosDeLaOperacion({ antes: x, despues: x, probabilidad: null, reglas: [], instrumentoId: "FICTICIA-A", precioLimite: D("100"), hoy: ENTRADAS.hoy })).toEqual([]);
  });
});
