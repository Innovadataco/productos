import { describe, expect, it } from "vitest";
import { compararPuntos, type LadosComparacion } from "@/analisis/puntos/comparar";
import { importanciaDe } from "@/analisis/puntos/rangos";
import { identidadDe } from "@/analisis/puntos/tipos";
import type { ClavePunto, Punto, Rango, Sujeto } from "@/analisis/puntos/tipos";

const esp = (id: string): Sujeto => ({ tipo: "ESPECIE", instrumentoId: id });
const PORT: Sujeto = { tipo: "PORTAFOLIO" };
const p = (clave: ClavePunto, sujeto: Sujeto, rango: Rango, medido = 0.5): Punto => ({ clave, sujeto, rango, importancia: importanciaDe(clave, rango), medido });
const lados = (antes: Punto[] | null, despues: Punto[] | null, pa: [string, number][] = [], pd: [string, number][] = []): LadosComparacion => ({
  antes, despues, pesos: { antes: Object.fromEntries(pa), despues: Object.fromEntries(pd) },
});

describe("compararPuntos", () => {
  it("el mismo rango no emite nada", () => {
    const x = [p("PESO_ESPECIE", esp("FICTICIA-A"), "ELEVADO")];
    expect(compararPuntos(lados(x, x))).toEqual([]);
  });
  it("los cuatro cambios", () => {
    const a = esp("FICTICIA-A");
    const b = esp("FICTICIA-B");
    const c = esp("FICTICIA-C");
    const d = esp("FICTICIA-D");
    const r = compararPuntos(
      lados(
        [p("PESO_ESPECIE", a, "ELEVADO"), p("PESO_ESPECIE", b, "MUY_ELEVADO"), p("PESO_ESPECIE", c, "ELEVADO")],
        [p("PESO_ESPECIE", a, "MUY_ELEVADO"), p("PESO_ESPECIE", b, "ELEVADO"), p("PESO_ESPECIE", d, "ELEVADO")],
      ),
    );
    const por = (id: string) => r.find((x) => x.sujeto.tipo === "ESPECIE" && x.sujeto.instrumentoId === id)!;
    expect(por("FICTICIA-A").cambio).toBe("SUBE");
    expect(por("FICTICIA-B").cambio).toBe("BAJA");
    expect(por("FICTICIA-C")).toMatchObject({ cambio: "DESAPARECE", despues: null, antes: { rango: "ELEVADO" } });
    expect(por("FICTICIA-D")).toMatchObject({ cambio: "APARECE", antes: null, despues: { rango: "ELEVADO" } });
  });
  it("la importancia del cambio es la mayor entre antes y después", () => {
    const [x] = compararPuntos(lados([p("PESO_ESPECIE", esp("FICTICIA-A"), "MUY_ELEVADO")], []));
    expect(x).toMatchObject({ cambio: "DESAPARECE", importancia: "ALTA" });
    const [y] = compararPuntos(lados([p("PESO_ESPECIE", esp("FICTICIA-A"), "MUY_ELEVADO")], [p("PESO_ESPECIE", esp("FICTICIA-A"), "ELEVADO")]));
    expect(y!.importancia).toBe("ALTA");
  });
  it("nunca una MEDIA antes que una ALTA; dentro del nivel, por el peso", () => {
    const r = compararPuntos(
      lados(
        [],
        [
          p("PESO_ESPECIE", esp("FICTICIA-A"), "ELEVADO"),
          p("PESO_ESPECIE", esp("FICTICIA-B"), "MUY_ELEVADO"),
          p("PUNTO_CONCENTRACION", PORT, "ELEVADA"),
          p("PESO_ESPECIE", esp("FICTICIA-C"), "ELEVADO"),
          p("PUNTO_EFECTO_CAIDA", esp("FICTICIA-A"), "MEDIANO"),
        ],
        [],
        [["FICTICIA-A", 0.3], ["FICTICIA-B", 0.5], ["FICTICIA-C", 0.35]],
      ),
    );
    expect(r.map((x) => x.importancia)).toEqual(["ALTA", "MEDIA", "MEDIA", "MEDIA", "BAJA"]);
    // portafolio (peso 1) primero, luego C (0,35) y A (0,30)
    expect(r.slice(1).map((x) => `${x.clave}:${x.pesoEspecie}`)).toEqual(["PUNTO_CONCENTRACION:1", "PESO_ESPECIE:0.35", "PESO_ESPECIE:0.3", "PUNTO_EFECTO_CAIDA:0.3"]);
  });
  it("el desempate es APARECE, SUBE, BAJA, DESAPARECE y es determinista", () => {
    const a = esp("FICTICIA-A");
    const entrada = lados(
      [p("PESO_ESPECIE", a, "ELEVADO"), p("PUNTO_EFECTO_CAIDA", a, "GRANDE"), p("PROBABILIDAD_BAJO_APORTADO", PORT, "ELEVADA")],
      [p("PESO_ESPECIE", a, "MUY_ELEVADO"), p("PUNTO_EFECTO_CAIDA", a, "MEDIANO"), p("PUNTO_CONCENTRACION", PORT, "MODERADA")],
      [["FICTICIA-A", 0.3]], [["FICTICIA-A", 0.3]],
    );
    const r = compararPuntos(entrada);
    expect(compararPuntos(entrada)).toEqual(r);
    expect(compararPuntos(lados([...entrada.antes!].reverse(), [...entrada.despues!].reverse(), [["FICTICIA-A", 0.3]], [["FICTICIA-A", 0.3]]))).toEqual(r);
  });
  it("con el mismo nivel y peso, el tipo de cambio ordena APARECE, SUBE, BAJA, DESAPARECE", () => {
    const s = (n: string) => esp(`FICTICIA-${n}`);
    const r = compararPuntos(
      lados(
        [p("PESO_ESPECIE", s("D"), "ELEVADO"), p("PESO_ESPECIE", s("B"), "ELEVADO"), p("PESO_ESPECIE", s("C"), "MUY_ELEVADO")],
        [p("PESO_ESPECIE", s("A"), "ELEVADO"), p("PESO_ESPECIE", s("B"), "MUY_ELEVADO"), p("PESO_ESPECIE", s("C"), "ELEVADO")],
        [["FICTICIA-D", 0.3], ["FICTICIA-B", 0.3], ["FICTICIA-C", 0.3]], [["FICTICIA-A", 0.3], ["FICTICIA-B", 0.3], ["FICTICIA-C", 0.3]],
      ),
    );
    // B sube a MUY_ELEVADO (ALTA), C baja de MUY_ELEVADO (ALTA): ALTA primero y SUBE antes que BAJA; luego MEDIA: APARECE antes que DESAPARECE
    expect(r.map((x) => x.cambio)).toEqual(["SUBE", "BAJA", "APARECE", "DESAPARECE"]);
  });
  it("un lado sin calcular no emite nada (sin falsos «desaparece»)", () => {
    const x = [p("PESO_ESPECIE", esp("FICTICIA-A"), "ELEVADO")];
    expect(compararPuntos(lados(x, null))).toEqual([]);
    expect(compararPuntos(lados(null, x))).toEqual([]);
  });
  it("los puntos de la orden: la identidad es la regla y la especie", () => {
    const o: Sujeto = { tipo: "ORDEN", reglaId: "R1", instrumentoId: "FICTICIA-B" };
    const [x] = compararPuntos(lados([], [p("REGLA_TOCADA", o, "TOCADA", 0)], [], [["FICTICIA-B", 0.2]]));
    expect(x).toMatchObject({ cambio: "APARECE", importancia: "ALTA", pesoEspecie: 0.2, sujeto: o });
  });
  it("sobrevive a una ida y vuelta por JSON", () => {
    const r = compararPuntos(lados([], [p("PUNTO_CONCENTRACION", PORT, "ELEVADA")]));
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
  it("lo que un lado no pudo calcular no es un cambio: ni «desaparece» ni «aparece» falsos", () => {
    const a = esp("FICTICIA-A");
    const x = p("PUNTO_EFECTO_CAIDA", a, "GRANDE");
    const idX = identidadDe(x.clave, x.sujeto);
    expect(compararPuntos({ ...lados([x], []), sinCalcular: { antes: [], despues: [idX] } })).toEqual([]);
    expect(compararPuntos({ ...lados([], [x]), sinCalcular: { antes: [idX], despues: [] } })).toEqual([]);
    // Control positivo: si el después sí se calculó, el punto desaparece de verdad.
    expect(compararPuntos({ ...lados([x], []), sinCalcular: { antes: [], despues: [] } })).toHaveLength(1);
    // Solo se omite la identidad sin calcular.
    const y = p("PESO_ESPECIE", a, "ELEVADO");
    expect(compararPuntos({ ...lados([x, y], []), sinCalcular: { antes: [], despues: [idX] } }).map((c) => c.clave)).toEqual(["PESO_ESPECIE"]);
  });
  it("con todo igual, el desempate final es el sujeto", () => {
    const r = compararPuntos(lados([], [p("PESO_ESPECIE", esp("FICTICIA-B"), "ELEVADO"), p("PESO_ESPECIE", esp("FICTICIA-A"), "ELEVADO"), p("PESO_ESPECIE", esp("FICTICIA-C"), "ELEVADO")]));
    expect(r.map((c) => (c.sujeto.tipo === "ESPECIE" ? c.sujeto.instrumentoId : ""))).toEqual(["FICTICIA-A", "FICTICIA-B", "FICTICIA-C"]);
    const inversa = compararPuntos(lados([], [p("PESO_ESPECIE", esp("FICTICIA-C"), "ELEVADO"), p("PESO_ESPECIE", esp("FICTICIA-A"), "ELEVADO"), p("PESO_ESPECIE", esp("FICTICIA-B"), "ELEVADO")]));
    expect(inversa).toEqual(r);
  });
});
