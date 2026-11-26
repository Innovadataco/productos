import { describe, expect, it } from "vitest";
import { puntoBajoAportado, puntosDelAnalisis, sinCalcularDelAnalisis } from "@/analisis/puntos/calcular";
import { D } from "../fixtures/portafolio.ficticio";
import { analisis, concentracion, cubierta, especie, sinValor } from "../fixtures/analisis.ficticio";
import type { Analisis, EspecieConValor } from "@/analisis/tipos";

const claves = (a: Analisis) => puntosDelAnalisis(a).map((p) => `${p.clave}:${p.rango}`);
const conc = (hhi: number) => ({ ...concentracion(0.2, 0.6, 5), hhi });

describe("puntosDelAnalisis", () => {
  it("un portafolio sin nada que señalar no da puntos", () => {
    expect(puntosDelAnalisis(analisis({ especies: [especie("FICTICIA-A")], concentracion: conc(0.1) }))).toEqual([]);
  });
  it("el peso de una especie da un punto con su sujeto", () => {
    const [p] = puntosDelAnalisis(analisis({ especies: [especie("FICTICIA-B", { peso: 0.45 })] }));
    expect(p).toEqual({ clave: "PESO_ESPECIE", sujeto: { tipo: "ESPECIE", instrumentoId: "FICTICIA-B" }, rango: "MUY_ELEVADO", importancia: "ALTA", medido: 0.45 });
  });
  it("el HHI es un punto del portafolio", () => {
    const [p] = puntosDelAnalisis(analisis({ concentracion: conc(0.3) }));
    expect(p).toMatchObject({ clave: "PUNTO_CONCENTRACION", sujeto: { tipo: "PORTAFOLIO" }, rango: "ELEVADA", importancia: "MEDIA" });
  });
  it("la contribución al riesgo compara las veces y exige la contribución mínima", () => {
    const e = (pct: number, peso: number) => especie("FICTICIA-A", { peso: 0.2, riesgo: cubierta(peso, pct) });
    expect(claves(analisis({ especies: [e(0.6, 0.4)] }))).toEqual(["PUNTO_CONTRIBUCION_RIESGO:DESPROPORCIONADA"]);
    expect(claves(analisis({ especies: [e(0.5, 0.2)] }))).toEqual(["PUNTO_CONTRIBUCION_RIESGO:MUY_DESPROPORCIONADA"]);
    expect(claves(analisis({ especies: [e(0.09, 0.01)] }))).toEqual([]);
    expect(claves(analisis({ especies: [e(0.5, 0)] }))).toEqual([]);
  });
  it("sin contribución, sin historia o sin valor no hay punto de riesgo", () => {
    const sinHistoria: EspecieConValor = especie("FICTICIA-A", { riesgo: { estado: "SIN_HISTORIA", motivo: "SIN_CIERRES", dias: 0 } });
    expect(claves(analisis({ especies: [especie("FICTICIA-A", { riesgo: cubierta(0.2, null) }), sinHistoria, sinValor("FICTICIA-B")] }))).toEqual([]);
  });
  it("el efecto de una caída usa el valor absoluto de la fracción del portafolio", () => {
    const e = (f: number) => especie("FICTICIA-A", { efectoCaida: { pesos: D(-1), fraccionPortafolio: f } });
    expect(claves(analisis({ especies: [e(-0.07)] }))).toEqual(["PUNTO_EFECTO_CAIDA:MEDIANO"]);
    expect(claves(analisis({ especies: [e(-0.1)] }))).toEqual(["PUNTO_EFECTO_CAIDA:GRANDE"]);
    expect(claves(analisis({ especies: [e(-0.04)] }))).toEqual([]);
  });
  it("es determinista y JSON puro", () => {
    const a = analisis({ especies: [especie("FICTICIA-B", { peso: 0.45 })], concentracion: conc(0.3) });
    expect(puntosDelAnalisis(a)).toEqual(puntosDelAnalisis(a));
    const p = puntosDelAnalisis(a);
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });
});

describe("puntoBajoAportado", () => {
  it("da el punto del portafolio con la probabilidad", () => {
    expect(puntoBajoAportado(0.3)).toEqual([{ clave: "PROBABILIDAD_BAJO_APORTADO", sujeto: { tipo: "PORTAFOLIO" }, rango: "ELEVADA", importancia: "MEDIA", medido: 0.3 }]);
    expect(puntoBajoAportado(0.1)[0]).toMatchObject({ rango: "INTERMEDIA", importancia: "BAJA" });
  });
  it("sin probabilidad o por debajo del primer tramo no hay punto", () => {
    expect(puntoBajoAportado(null)).toEqual([]);
    expect(puntoBajoAportado(0.05)).toEqual([]);
  });
});

describe("sinCalcularDelAnalisis", () => {
  const id = (clave: string, instrumentoId: string) => `${clave}|${JSON.stringify({ tipo: "ESPECIE", instrumentoId })}`;
  it("un análisis completo no deja nada sin calcular", () => {
    const e = especie("FICTICIA-A", { riesgo: cubierta(0.2, 0.5), efectoCaida: { pesos: D(-1), fraccionPortafolio: -0.01 } });
    expect(sinCalcularDelAnalisis(analisis({ especies: [e], concentracion: conc(0.1) }))).toEqual([]);
  });
  it("sin concentración, sin valor, sin historia, sin contribución o sin efecto de caída, lo dice por identidad", () => {
    const a = analisis({
      concentracion: null,
      especies: [
        sinValor("FICTICIA-A"),
        especie("FICTICIA-B", { riesgo: { estado: "SIN_HISTORIA", motivo: "SIN_CIERRES", dias: 0 }, efectoCaida: null }),
        especie("FICTICIA-C", { riesgo: cubierta(0.2, null), efectoCaida: { pesos: D(-1), fraccionPortafolio: -0.01 } }),
      ],
    });
    const r = sinCalcularDelAnalisis(a);
    expect(r).toContain(`PUNTO_CONCENTRACION|${JSON.stringify({ tipo: "PORTAFOLIO" })}`);
    for (const c of ["PESO_ESPECIE", "PUNTO_CONTRIBUCION_RIESGO", "PUNTO_EFECTO_CAIDA"]) expect(r).toContain(id(c, "FICTICIA-A"));
    for (const c of ["PUNTO_CONTRIBUCION_RIESGO", "PUNTO_EFECTO_CAIDA"]) expect(r).toContain(id(c, "FICTICIA-B"));
    expect(r).toContain(id("PUNTO_CONTRIBUCION_RIESGO", "FICTICIA-C"));
    expect(r).not.toContain(id("PESO_ESPECIE", "FICTICIA-B"));
    expect(r).not.toContain(id("PUNTO_EFECTO_CAIDA", "FICTICIA-C"));
  });
  it("una contribución por debajo del mínimo sí se calculó: no entra", () => {
    const a = analisis({ especies: [especie("FICTICIA-A", { riesgo: cubierta(0.01, 0.05) })], concentracion: conc(0.1) });
    expect(sinCalcularDelAnalisis(a)).not.toContain(id("PUNTO_CONTRIBUCION_RIESGO", "FICTICIA-A"));
  });
});
