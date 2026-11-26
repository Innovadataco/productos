import { describe, expect, it } from "vitest";
import { fraseDelCambio, ETIQUETA_RANGO } from "@/analisis/puntos/etiquetas";
import { CLAVES_PUNTO, type PuntoCambio, type Sujeto } from "@/analisis/puntos/tipos";
import { TRAMOS } from "@/analisis/puntos/rangos";

const NOMBRES = new Map([["FICTICIA-B", "FICTICIA-B"], ["FICTICIA-A", "FICTICIA-A"]]);
const sujetoDe = (clave: string): Sujeto => (clave.startsWith("REGLA_") ? { tipo: "ORDEN", reglaId: "R1", instrumentoId: "FICTICIA-B" } : { tipo: "ESPECIE", instrumentoId: "FICTICIA-B" });

describe("frases de los cambios", () => {
  it("el peso de una especie que sube a muy elevado", () => {
    const c: PuntoCambio = { clave: "PESO_ESPECIE", sujeto: { tipo: "ESPECIE", instrumentoId: "FICTICIA-B" }, cambio: "SUBE", antes: { rango: "ELEVADO", importancia: "MEDIA", medido: 0.3 }, despues: { rango: "MUY_ELEVADO", importancia: "ALTA", medido: 0.45 }, importancia: "ALTA", pesoEspecie: 0.45 };
    expect(fraseDelCambio(c, NOMBRES)).toBe("El peso de «FICTICIA-B» pasa de elevado a muy elevado");
  });
  it("concuerdan en género y número según la clave", () => {
    const f = (clave: "PUNTO_CONCENTRACION" | "PROBABILIDAD_BAJO_APORTADO") =>
      fraseDelCambio({ clave, sujeto: { tipo: "PORTAFOLIO" }, cambio: "APARECE", antes: null, despues: { rango: "ELEVADA", importancia: "MEDIA", medido: 0.3 }, importancia: "MEDIA", pesoEspecie: 1 }, NOMBRES);
    expect(f("PUNTO_CONCENTRACION")).toBe("La concentración del portafolio (HHI) pasa a ser elevada");
    expect(f("PROBABILIDAD_BAJO_APORTADO")).toBe("La probabilidad de quedar por debajo de lo aportado pasa a ser elevada");
  });
  it("la regla dice que se mide con el precio límite de la orden", () => {
    const c: PuntoCambio = { clave: "REGLA_TOCADA", sujeto: sujetoDe("REGLA_TOCADA"), cambio: "APARECE", antes: null, despues: { rango: "TOCADA", importancia: "ALTA", medido: 0 }, importancia: "ALTA", pesoEspecie: 0.2 };
    expect(fraseDelCambio(c, NOMBRES)).toBe("Con el precio límite de la orden, la regla de «FICTICIA-B» queda tocada");
  });
  it("una especie sin nombre se dice «otra especie» y las comillas del nombre no rompen la etiqueta", () => {
    const c: PuntoCambio = { clave: "PESO_ESPECIE", sujeto: { tipo: "ESPECIE", instrumentoId: "X" }, cambio: "APARECE", antes: null, despues: { rango: "ELEVADO", importancia: "MEDIA", medido: 0.3 }, importancia: "MEDIA", pesoEspecie: 0.3 };
    expect(fraseDelCambio(c, new Map())).toContain("«otra especie»");
    expect(fraseDelCambio(c, new Map([["X", "A»B«"]]))).toContain("«AB»");
  });
  it("hay una etiqueta por cada rango", () => {
    for (const c of CLAVES_PUNTO) for (const t of TRAMOS[c]) expect(ETIQUETA_RANGO[c][t.rango], `${c}:${t.rango}`).toBeTruthy();
  });
  it("cada clave tiene su sujeto, y desaparece y baja se dicen con el mismo género", () => {
    const lado = (clave: PuntoCambio["clave"], i = 0) => { const t = TRAMOS[clave][i]!; return { rango: t.rango, importancia: t.importancia, medido: t.limite }; };
    const c = (clave: PuntoCambio["clave"], cambio: PuntoCambio["cambio"]): PuntoCambio => ({
      clave, sujeto: sujetoDe(clave), cambio, antes: cambio === "APARECE" ? null : lado(clave), despues: cambio === "DESAPARECE" ? null : lado(clave, TRAMOS[clave].length - 1), importancia: "MEDIA", pesoEspecie: 0.3,
    });
    expect(fraseDelCambio(c("PUNTO_CONTRIBUCION_RIESGO", "DESAPARECE"), NOMBRES)).toBe("La contribución de «FICTICIA-B» al riesgo deja de ser mayor que su peso");
    expect(fraseDelCambio(c("PUNTO_EFECTO_CAIDA", "BAJA"), NOMBRES)).toBe("El efecto de una caída de «FICTICIA-B» en el portafolio pasa de mediano a grande");
    expect(fraseDelCambio(c("PROBABILIDAD_BAJO_APORTADO", "SUBE"), NOMBRES)).toBe("La probabilidad de quedar por debajo de lo aportado pasa de intermedia a elevada");
    expect(fraseDelCambio(c("REGLA_DISTANCIA", "DESAPARECE"), NOMBRES)).toBe("Con el precio límite de la orden, la regla de «FICTICIA-B» deja de quedar a poca distancia de su nivel");
    expect(fraseDelCambio(c("REGLA_EN_EL_NIVEL", "APARECE"), NOMBRES)).toBe("Con el precio límite de la orden, la regla de «FICTICIA-B» queda en su nivel");
  });
});
