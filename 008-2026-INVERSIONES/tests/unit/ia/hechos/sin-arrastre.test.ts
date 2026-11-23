/**
 * Sin arrastre de nombres (frente ia-diario-especie): ningún ESPECIE_NOMBRE es obligatorio en los casos inventados.
 * No afloja nada: el validador sigue exigiendo el nombre de la especie en la misma frase de cada dato de especie que se
 * cite (ETIQUETA.SIN_SUJETO), y todo dato obligatorio se tiene que citar. Control positivo: la frase sin el nombre se
 * rechaza; con el nombre del campo `especie`, ese hallazgo no aparece.
 */
import { describe, expect, it } from "vitest";
import { casosInventados } from "@/ia/evaluacion/casos";
import { validarSalida } from "@/ia/validador/validar";
import { vistaCiega } from "@/ia/vista-ciega";

const casos = casosInventados();
const salida = (...segmentos: readonly object[]): string => JSON.stringify({ frases: [{ segmentos }] });

describe("sin arrastre de nombres de especie", () => {
  it("ningún nombre de especie es obligatorio, y los datos obligatorios de especie siguen ahí", () => {
    expect(casos.flatMap((c) => c.paquete.hechos).some((h) => h.clave === "ESPECIE_NOMBRE" && h.obligatorio)).toBe(false);
    expect(casos.flatMap((c) => c.paquete.hechos).some((h) => h.obligatorio && h.sujeto !== undefined)).toBe(true);
  });

  it("control positivo: citar la regla tocada sin el nombre de su especie se rechaza; con el nombre, no por eso", () => {
    const caso = casos.find((c) => c.tipo === "REGLAS" && c.paquete.hechos.some((h) => h.clave === "REGLA_TOCADA"));
    if (caso === undefined) throw new Error("falta un caso REGLAS con regla tocada");
    const tocada = vistaCiega(caso.paquete).hechos.find((h) => h.clave === "REGLA_TOCADA");
    if (tocada?.especie === undefined) throw new Error("la regla tocada no trae especie");
    const sinNombre = validarSalida(salida({ texto: "La regla tocada es" }, { ref: tocada.id }, { texto: "." }), caso.paquete);
    expect(sinNombre.ok).toBe(false);
    if (!sinNombre.ok) expect(sinNombre.hallazgos.map((h) => h.patron)).toContain("ETIQUETA.SIN_SUJETO");
    const conNombre = validarSalida(salida({ texto: "La regla tocada de la especie" }, { ref: tocada.especie }, { texto: "es" }, { ref: tocada.id }, { texto: "." }), caso.paquete);
    const patrones = conNombre.ok ? [] : conNombre.hallazgos.map((h) => h.patron);
    expect(patrones).not.toContain("ETIQUETA.SIN_SUJETO");
    expect(patrones).not.toContain("ETIQUETA.SUJETO_AJENO");
  });
});
