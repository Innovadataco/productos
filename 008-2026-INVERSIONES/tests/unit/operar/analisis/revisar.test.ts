// «Para revisar» en palabras: los ítems de la vista (importancia en texto y nivel para la pantalla), las notas con cifras en español y el
// barrido de lenguaje sobre todas las combinaciones de clave, rango y cambio, con control positivo. Datos inventados.
import { describe, expect, it } from "vitest";
import { CLAVES_PUNTO, type PuntoCambio, type Sujeto, type TipoCambio } from "@/analisis/puntos/tipos";
import { TRAMOS, importanciaDe } from "@/analisis/puntos/rangos";
import { itemsParaRevisar } from "@/operar/analisis/revisar";
import { prohibidasEn } from "../informe/lenguaje";

const NOMBRES = new Map([["FICTICIA-B", "FICTICIA-B"], ["FICTICIA-A", "FICTICIA-A"]]);
const EXTRA = /atenci[oó]n|\bmire\b|\bojo\b|cuidado|f[ií]jese/i;
const sujetoDe = (clave: string): Sujeto =>
  clave.startsWith("REGLA_") ? { tipo: "ORDEN", reglaId: "R1", instrumentoId: "FICTICIA-B" } : clave === "PUNTO_CONCENTRACION" || clave === "PROBABILIDAD_BAJO_APORTADO" ? { tipo: "PORTAFOLIO" } : { tipo: "ESPECIE", instrumentoId: "FICTICIA-B" };

function todos(): PuntoCambio[] {
  const tipos: TipoCambio[] = ["APARECE", "DESAPARECE", "SUBE", "BAJA"];
  return CLAVES_PUNTO.flatMap((clave) =>
    TRAMOS[clave].flatMap((a) =>
      TRAMOS[clave].flatMap((d) =>
        tipos.map((cambio): PuntoCambio => {
          const l = (t: typeof a) => ({ rango: t.rango, importancia: importanciaDe(clave, t.rango), medido: t.limite });
          return { clave, sujeto: sujetoDe(clave), cambio, antes: cambio === "APARECE" ? null : l(a), despues: cambio === "DESAPARECE" ? null : l(d), importancia: "MEDIA", pesoEspecie: 0.3 };
        }),
      ),
    ),
  );
}

describe("items para revisar", () => {
  it("la importancia va en texto y la nota trae antes, después y umbral con las cifras en español", () => {
    const c: PuntoCambio = { clave: "PESO_ESPECIE", sujeto: { tipo: "ESPECIE", instrumentoId: "FICTICIA-B" }, cambio: "SUBE", antes: { rango: "ELEVADO", importancia: "MEDIA", medido: 0.3 }, despues: { rango: "MUY_ELEVADO", importancia: "ALTA", medido: 0.4513 }, importancia: "ALTA", pesoEspecie: 0.45 };
    const [i] = itemsParaRevisar([c], NOMBRES);
    expect(i).toEqual({ nivel: "ALTA", importancia: "Importancia alta", frase: "El peso de «FICTICIA-B» pasa de elevado a muy elevado", nota: "Antes 30,00 % · después 45,13 % · umbral más de 40,00 %" });
  });
  it("el nivel sale de la importancia del cambio, no del texto", () => {
    const base = { clave: "PESO_ESPECIE", sujeto: { tipo: "ESPECIE", instrumentoId: "FICTICIA-B" }, cambio: "APARECE", antes: null, despues: { rango: "ELEVADO", importancia: "MEDIA", medido: 0.3 }, pesoEspecie: 0.3 } as const;
    expect(itemsParaRevisar([{ ...base, importancia: "MEDIA" }, { ...base, importancia: "BAJA" }], NOMBRES).map((i) => [i.nivel, i.importancia])).toEqual([["MEDIA", "Importancia media"], ["BAJA", "Importancia baja"]]);
  });
  it("sin cambios no hay items", () => expect(itemsParaRevisar([], NOMBRES)).toEqual([]));
  it("si el punto desaparece, el lado de después dice que ya no aplica", () => {
    const c: PuntoCambio = { clave: "PUNTO_CONCENTRACION", sujeto: { tipo: "PORTAFOLIO" }, cambio: "DESAPARECE", antes: { rango: "ELEVADA", importancia: "MEDIA", medido: 0.3 }, despues: null, importancia: "MEDIA", pesoEspecie: 1 };
    expect(itemsParaRevisar([c], NOMBRES)[0]!.nota).toBe("Antes 0,300 · después ya no aplica · umbral más de 0,250");
  });
  it("las cifras del HHI y de las veces usan coma", () => {
    const hhi = itemsParaRevisar([{ clave: "PUNTO_CONCENTRACION", sujeto: { tipo: "PORTAFOLIO" }, cambio: "APARECE", antes: null, despues: { rango: "ELEVADA", importancia: "MEDIA", medido: 0.3 }, importancia: "MEDIA", pesoEspecie: 1 }], NOMBRES);
    expect(hhi[0]!.nota).toBe("Antes no aplicaba · después 0,300 · umbral más de 0,250");
    const veces = itemsParaRevisar([{ clave: "PUNTO_CONTRIBUCION_RIESGO", sujeto: sujetoDe("PUNTO_CONTRIBUCION_RIESGO"), cambio: "APARECE", antes: null, despues: { rango: "DESPROPORCIONADA", importancia: "MEDIA", medido: 1.52 }, importancia: "MEDIA", pesoEspecie: 0.3 }], NOMBRES);
    expect(veces[0]!.nota).toBe("Antes no aplicaba · después 1,52 veces · umbral desde 1,50 veces");
  });
});

describe("lenguaje de los textos nuevos", () => {
  const textos = itemsParaRevisar(todos(), NOMBRES).flatMap((i) => [i.importancia, i.frase, i.nota]);
  it("el barrido cubre todas las combinaciones", () => expect(textos.length).toBeGreaterThan(300));
  it("sin consejo ni lenguaje de aviso", () => {
    for (const t of textos) {
      expect(prohibidasEn(t), t).toEqual([]);
      expect(t).not.toMatch(EXTRA);
    }
  });
  it("control positivo: el detector muerde", () => {
    expect(prohibidasEn("le conviene")).not.toEqual([]);
    expect(EXTRA.test("Mire con cuidado")).toBe(true);
  });
});
