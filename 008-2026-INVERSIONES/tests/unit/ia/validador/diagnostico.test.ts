/**
 * Diagnóstico de un rechazo (T1, solo lectura): re-corre el validador actual sobre la salida guardada y dice, por
 * hallazgo, el código, el patrón, el número de frase, la parte (CODIGO o MODELO) y la frase con las citas como «{Hnn}»
 * y los dígitos como «#» (nunca una cifra del modelo). Datos inventados.
 */
import { describe, expect, it } from "vitest";
import { VERSION_VALIDADOR } from "@/ia/validador/codigos";
import { diagnosticarSalida, enmascarar, informeDeFila, lineaDeHallazgo } from "@/ia/validador/diagnostico";
import { FRASES_VALIDAS, frase, paqueteFicticio, salida, salidaDe } from "./apoyo/salidas.ficticio";

const paquete = paqueteFicticio("DIARIO");

describe("enmascarar", () => {
  it("deja las citas como {Hnn} y cambia el resto de los dígitos por #", () => {
    expect(enmascarar("Subió {H03} y cerró en 4613,27 el 2027-03-17.")).toBe("Subió {Hnn} y cerró en ####,## el ####-##-##.");
  });
  it("no toca un texto sin dígitos ni citas", () => {
    expect(enmascarar("Sin cifras.")).toBe("Sin cifras.");
  });
  it("cambia también los dígitos no latinos y los de ancho completo", () => {
    expect(enmascarar("١٢٣ y １２")).toBe("### y ##");
  });
});

describe("diagnosticarSalida", () => {
  it("una salida que el validador acepta no tiene hallazgos", () => {
    expect(diagnosticarSalida(salidaDe(paquete, ...FRASES_VALIDAS.DIARIO), paquete)).toEqual([]);
  });

  it("una frase con una cifra suelta: código, patrón, número de frase, parte y texto sin dígitos", () => {
    const cruda = salida(frase(paquete, FRASES_VALIDAS.DIARIO[0] as string), { texto: "El valor cerró en 4613,27 hoy.", hechos: [] });
    const hallazgos = diagnosticarSalida(cruda, paquete);
    const suelta = hallazgos.find((h) => h.codigo === "CIFRA_SUELTA");
    expect(suelta).toBeDefined();
    expect(suelta).toMatchObject({ frase: 1, parte: "MODELO" });
    expect(suelta?.patron).toMatch(/^CIFRA_SUELTA\./);
    expect(suelta?.texto).toBe("El valor cerró en ####,## hoy.");
    for (const h of hallazgos) expect(JSON.stringify(h)).not.toMatch(/4613/);
  });

  it("una salida ilegible: SALIDA_INVALIDA sin frase ni parte ni texto", () => {
    const [h, ...resto] = diagnosticarSalida("no es json", paquete);
    expect(resto).toEqual([]);
    expect(h).toEqual({ codigo: "SALIDA_INVALIDA", patron: "SALIDA_INVALIDA.LECTURA", frase: null, parte: null, texto: null });
  });

  it("una salida nula (la fila no la guardó) es SALIDA_INVALIDA", () => {
    expect(diagnosticarSalida(null, paquete).map((h) => h.codigo)).toEqual(["SALIDA_INVALIDA"]);
  });

  it("un hallazgo de la salida entera (el total de frases) no lleva frase ni parte", () => {
    const h = diagnosticarSalida(JSON.stringify({ frases: [] }), paquete).find((x) => x.patron === "LONGITUD.FRASES");
    expect(h).toMatchObject({ frase: null, parte: null, texto: null });
  });

  it("las primeras frasesDelCodigo frases son del CODIGO y el resto del MODELO", () => {
    const cruda = salida(
      { texto: "Una con cifra 12.", hechos: [] },
      { texto: "Otra con cifra 34.", hechos: [] },
    );
    const partes = diagnosticarSalida(cruda, paquete, 1).filter((h) => h.codigo === "CIFRA_SUELTA").map((h) => [h.frase, h.parte]);
    expect(partes).toEqual([[0, "CODIGO"], [1, "MODELO"]]);
  });

  it("es determinista y no repite hallazgos", () => {
    const cruda = salida({ texto: "Cifra 12 y 34.", hechos: [] });
    const a = diagnosticarSalida(cruda, paquete);
    expect(diagnosticarSalida(cruda, paquete)).toEqual(a);
    const claves = a.map((h) => `${h.patron}|${h.frase}`);
    expect(new Set(claves).size).toBe(claves.length);
  });
});

describe("lineaDeHallazgo", () => {
  it("imprime código, patrón, frase, parte y texto", () => {
    const l = lineaDeHallazgo({ codigo: "IDIOMA", patron: "IDIOMA.VOCABULARIO", frase: 2, parte: "MODELO", texto: "Algo ##." });
    expect(l).toBe("IDIOMA · IDIOMA.VOCABULARIO · frase 2 · MODELO · «Algo ##.»");
  });
  it("sin frase imprime «salida entera»", () => {
    const l = lineaDeHallazgo({ codigo: "LONGITUD", patron: "LONGITUD.TOTAL", frase: null, parte: null, texto: null });
    expect(l).toBe("LONGITUD · LONGITUD.TOTAL · salida entera");
  });
});

describe("informeDeFila", () => {
  const fila = { id: "fila-ficticia", tipo: "DIARIO", validadorVersion: "validador-v1", motivos: ["CIFRA_SUELTA"] };

  it("abre con la versión del validador de la fila y la actual", () => {
    const [cabecera] = informeDeFila(fila, salida({ texto: "Cifra 12.", hechos: [] }), paquete);
    expect(cabecera).toContain("fila-ficticia");
    expect(cabecera).toContain("validador-v1");
    expect(cabecera).toContain(VERSION_VALIDADOR);
    expect(cabecera).toContain("CIFRA_SUELTA");
  });

  it("si el validador actual acepta la salida, lo dice", () => {
    const l = informeDeFila(fila, salidaDe(paquete, ...FRASES_VALIDAS.DIARIO), paquete);
    expect(l.at(-1)).toBe("SIN_RECHAZO · el validador actual acepta esta salida");
  });

  it("una fila sin salida guardada lo dice y no diagnostica", () => {
    const l = informeDeFila(fila, null, paquete);
    expect(l.at(-1)).toBe("SIN_SALIDA · la fila no guardó la salida del modelo");
  });

  it("ninguna línea trae un dígito de la salida del modelo", () => {
    const l = informeDeFila(fila, salida({ texto: "Cifra 98765.", hechos: [] }), paquete).join("\n");
    expect(l).not.toContain("98765");
  });
});
