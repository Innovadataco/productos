/**
 * RENDER_CIFRA, el cotejo del texto final (condición 2 de PI): cada número del texto final tiene que caer dentro de la
 * presentación, tomada del paquete construido, de una cita del texto del modelo, en orden. Nada de lo que repitió el
 * modelo cuenta: lo que sobra con un dígito, un signo o un símbolo de cifra, rechaza. Y el render pone exactamente esa
 * presentación (con una función: un «$» de la presentación no se interpreta).
 */
import { describe, expect, it } from "vitest";
import { cotejarCifras } from "@/ia/validador/cotejo";
import { renderizarFrase } from "@/ia/validador/render";
import { hechoDe, idDe, paqueteFicticio, presentacionDe } from "./apoyo/salidas.ficticio";

const p = paqueteFicticio("DIARIO");
const va = idDe(p, "VALOR_ACCIONES");
const ea = idDe(p, "ESPECIES_ATRASADAS");
const nombre = idDe(p, "ESPECIE_NOMBRE");
const pVa = presentacionDe(p, "VALOR_ACCIONES");
const pEa = presentacionDe(p, "ESPECIES_ATRASADAS");

describe("renderizarFrase", () => {
  it("cambia cada cita por la presentación del paquete, también con «$» y con nombres", () => {
    expect(pVa).toContain("$");
    expect(renderizarFrase(`El valor de las acciones subió a {${va}}.`, p)).toBe(`El valor de las acciones subió a ${pVa}.`);
    expect(renderizarFrase(`{${nombre}} y {${va}} y {${va}}.`, p)).toBe(`${presentacionDe(p, "ESPECIE_NOMBRE")} y ${pVa} y ${pVa}.`);
  });

  it("deja tal cual una cita que no está en el paquete (la rechaza otro control)", () => {
    expect(renderizarFrase("Una cita {H99} y otra {H00}.", p)).toBe("Una cita {H99} y otra {H00}.");
  });
});

describe("cotejarCifras", () => {
  it("el texto final bien armado pasa", () => {
    expect(cotejarCifras(`El valor de las acciones subió a ${pVa}.`, [va], p)).toBe(true);
    expect(cotejarCifras(`Son ${pEa} y luego ${pEa}.`, [ea, ea], p)).toBe(true);
    expect(cotejarCifras(`Son ${pEa}, ${pEa}.`, [ea, ea], p)).toBe(true);
    expect(cotejarCifras("Sin cifras ni citas.", [], p)).toBe(true);
  });

  it.each([
    ["un dígito que sobra antes", `En el corte 7391 el valor de las acciones subió a ${pVa}.`, [va]],
    ["un dígito que sobra al final", `El valor de las acciones subió a ${pVa} y 7391.`, [va]],
    ["la presentación escrita por el modelo además de la cita", `El valor ${pVa} de las acciones subió a ${pVa}.`, [va]],
    ["una cita sin su presentación en el texto final", "El valor de las acciones subió.", [va]],
    ["una presentación cambiada", `El valor de las acciones subió a ${pVa.replace(/[0-9]/u, (d) => String((Number(d) + 1) % 10))}.`, [va]],
    ["el signo pegado", `El valor de las acciones subió a −${pVa}.`, [va]],
    ["el guion pegado", `El valor de las acciones subió a -${pVa}.`, [va]],
    ["el más pegado", `El valor de las acciones subió a +${pVa}.`, [va]],
    ["un símbolo de cifra", `El valor de las acciones subió a ${pVa} %.`, [va]],
    ["dos presentaciones pegadas", `Son ${pEa}${pEa}.`, [ea, ea]],
    ["dos presentaciones con coma pegada", `Son ${pEa},${pEa}.`, [ea, ea]],
    ["dos presentaciones con punto pegado", `Son ${pEa}.${pEa}.`, [ea, ea]],
    ["un dígito de otro sistema", `El valor de las acciones subió a ${pVa} ٣.`, [va]],
    ["una cita que no está en el paquete", "El valor de las acciones subió a {H99}.", ["H99"]],
    ["las citas en otro orden", `Son ${pEa} y ${pVa}.`, [va, ea]],
  ] as const)("rechaza: %s", (_caso, texto, citas) => {
    expect(cotejarCifras(texto, citas, p)).toBe(false);
  });

  it("con un paquete que no salió de construirPaquete, no coteja nada (cierra en fallo)", () => {
    expect(cotejarCifras(`El valor de las acciones subió a ${pVa}.`, [va], { ...p })).toBe(false);
  });

  it("toma la presentación del paquete, no la que traiga quien llama", () => {
    const h = hechoDe(p, "VALOR_ACCIONES");
    expect(cotejarCifras(`Vale ${h.presentacion}.`, [h.id], p)).toBe(true);
    expect(cotejarCifras(`Vale ${h.valor}.`, [h.id], p)).toBe(h.valor === h.presentacion);
  });
});
