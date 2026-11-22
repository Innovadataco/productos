/**
 * La atribución de palabras a citas (`texto.ts`): la cita más cercana de su cláusula que no sea un nombre, con empates,
 * con la cláusula que solo nombra una especie y con la frase sin citas. Y lo que no es una palabra no tiene destino.
 */
import { describe, expect, it } from "vitest";
import { prepararTexto } from "@/ia/validador/patron";
import { atribuir, clausulasDe } from "@/ia/validador/texto";

const atribucion = (texto: string, destinos: readonly string[]) => atribuir(clausulasDe(prepararTexto(texto).minusculas), (id) => destinos.includes(id));
const palabrasDe = (a: ReturnType<typeof atribucion>, lugar: number): readonly string[] =>
  (a.porCita.get(lugar) ?? []).map((t) => (t.tipo === "PALABRA" ? t.texto : `{${t.id}}`));

describe("atribuir", () => {
  it("cada palabra a la cita más cercana de su cláusula; en un empate, a las dos", () => {
    const a = atribucion("uno dos {H03} tres medio {H04} cinco", ["H03", "H04"]);
    const [h03, h04] = a.destinos;
    expect(palabrasDe(a, h03?.lugar ?? -1)).toEqual(["uno", "dos", "tres"]);
    expect(palabrasDe(a, h04?.lugar ?? -1)).toEqual(["medio", "cinco"]);
    const empate = atribucion("uno {H03} dos {H04} tres", ["H03", "H04"]);
    expect(palabrasDe(empate, empate.destinos[0]?.lugar ?? -1)).toEqual(["uno", "dos"]);
    expect(palabrasDe(empate, empate.destinos[1]?.lugar ?? -1)).toEqual(["dos", "tres"]);
  });

  it("una cláusula sin destino que cita un nombre se queda con lo suyo; una sin citas va a la frase", () => {
    const a = atribucion("valor {H03}; nombre {H01}; suelta", ["H03"]);
    expect(palabrasDe(a, a.destinos[0]?.lugar ?? -1)).toEqual(["valor", "suelta"]);
    expect(a.sinDestino.map((t) => (t.tipo === "PALABRA" ? t.texto : t.id))).toEqual(["nombre", "H01"]);
  });

  it("sin ninguna cita de destino, nada se atribuye", () => {
    const a = atribucion("subió mucho", []);
    expect(a.destinos).toEqual([]);
    expect(a.sinDestino).toHaveLength(2);
  });

  it("una posición donde no empieza una palabra no tiene destino", () => {
    const a = atribucion("valor {H03}", ["H03"]);
    expect(a.destinosEn(0)).toEqual(["H03"]);
    expect(a.destinosEn(2)).toEqual([]);
    expect(a.destinosEn(4_613)).toEqual([]);
  });
});
