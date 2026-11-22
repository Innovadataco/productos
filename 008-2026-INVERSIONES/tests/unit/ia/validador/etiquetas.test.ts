/**
 * ETIQUETA_NO_COINCIDE: las palabras del alcance de una cita tienen que nombrar ESE dato. Las palabras clave salen del
 * catálogo en tiempo de ejecución (raíz de cinco letras sin tildes; la negación «no» o «sin» se pega a la palabra que
 * sigue; las siglas cuentan). Gana la clave que deja menos palabras clave sin explicar y, entre esas, la de mayor
 * cobertura de su etiqueta; un empate vale. La clave citada tiene que estar entre las ganadoras.
 */
import { describe, expect, it } from "vitest";
import { CATALOGO, CLAVE_NOMBRE_ESPECIE, clavesDe, entradaDeCatalogo, type ClaveHecho } from "@/ia/catalogo";
import { TIPOS_RESUMEN, type TipoResumen } from "@/ia/contrato";
import type { Hecho } from "@/ia/contrato";
import { claveCoincide, PALABRAS_VACIAS, palabrasClave, raicesDe, revisarEtiquetas } from "@/ia/validador/etiquetas";
import { esNombre, hechosPorId } from "@/ia/validador/hechos";
import { prepararTexto } from "@/ia/validador/patron";
import { atribuir, citasDe, clausulasDe } from "@/ia/validador/texto";
import { paqueteFicticio } from "./apoyo/salidas.ficticio";

const etiqueta = (tipo: TipoResumen, clave: ClaveHecho): string => entradaDeCatalogo(tipo, clave)?.etiqueta ?? "";
const raices = (texto: string): ReadonlySet<string> => new Set(raicesDe(texto.split(" ")));
const conCatalogo = (tipo: TipoResumen): readonly ClaveHecho[] => (clavesDe(tipo) as readonly ClaveHecho[]).filter((c) => c !== CLAVE_NOMBRE_ESPECIE);
const igualesComoConjunto = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x) => b.includes(x));

describe("palabras clave", () => {
  it("raíz de cinco letras, sin tildes, sin palabras vacías y con las siglas", () => {
    expect(palabrasClave("valor de las acciones")).toEqual(["valor", "accio"]);
    expect(palabrasClave("tasa de cambio representativa del mercado (TRM)")).toEqual(["tasa", "cambi", "repre", "merca", "trm"]);
    expect(palabrasClave("días que faltan para el plazo de la regla")).toEqual(["dia", "falta", "plazo", "regla"]);
    expect(palabrasClave("caída máxima mediana")).toEqual(["caida", "maxim", "media"]);
  });

  it("un texto sin letras no tiene palabras clave", () => {
    expect(palabrasClave("")).toEqual([]);
    expect(palabrasClave("(); .")).toEqual([]);
  });

  it("la negación se pega a la palabra que sigue", () => {
    expect(palabrasClave("corte de la conciliación que no cuadra")).toEqual(["corte", "conci", "nocuadr"]);
    expect(palabrasClave("ganancia sin vender")).toEqual(["ganan", "sinvende"]);
    expect(palabrasClave("especies sin precio")).toEqual(["espec", "sinpreci"]);
  });

  it("los plurales y el masculino comparten raíz; «cerró» va a «cierre»", () => {
    expect(raicesDe(["acciones", "acción", "especies", "especie", "tasas", "niveles", "partes", "parte"])).toEqual(["accio", "accio", "espec", "espec", "tasa", "nivel", "parte", "parte"]);
    expect(raicesDe(["cerró", "cerraron", "cierre", "cierres"])).toEqual(["cierr", "cierr", "cierr", "cierr"]);
  });

  it("las palabras vacías están congeladas y no son raíces de ninguna etiqueta", () => {
    expect(Object.isFrozen(PALABRAS_VACIAS)).toBe(true);
    expect(PALABRAS_VACIAS).toContain("de");
    for (const tipo of TIPOS_RESUMEN) {
      for (const entrada of Object.values(CATALOGO[tipo])) {
        for (const r of palabrasClave(entrada.etiqueta)) expect(PALABRAS_VACIAS).not.toContain(r);
      }
    }
  });

  it.each(TIPOS_RESUMEN)("%s: dos claves distintas nunca tienen las mismas palabras clave", (tipo) => {
    const claves = conCatalogo(tipo);
    for (const a of claves) {
      for (const b of claves) {
        if (a !== b) expect([a, b, igualesComoConjunto(palabrasClave(etiqueta(tipo, a)), palabrasClave(etiqueta(tipo, b)))]).toEqual([a, b, false]);
      }
    }
  });
});

describe("claveCoincide sobre el catálogo", () => {
  it.each(TIPOS_RESUMEN)("%s: la etiqueta tal cual coincide con su clave", (tipo) => {
    for (const clave of conCatalogo(tipo)) expect([clave, claveCoincide(tipo, clave, new Set(palabrasClave(etiqueta(tipo, clave))))]).toEqual([clave, true]);
  });

  it.each(TIPOS_RESUMEN)("%s: la etiqueta de OTRA clave no coincide (ningún par del catálogo)", (tipo) => {
    for (const citada of conCatalogo(tipo)) {
      for (const escrita of conCatalogo(tipo)) {
        if (citada === escrita) continue;
        expect([citada, escrita, claveCoincide(tipo, citada, new Set(palabrasClave(etiqueta(tipo, escrita))))]).toEqual([citada, escrita, false]);
      }
    }
  });

  it("cierra en fallo: un tipo que no existe, una clave de otro tipo o el nombre de la especie no coinciden", () => {
    const delValor = new Set(palabrasClave(etiqueta("DIARIO", "VALOR_ACCIONES")));
    expect(claveCoincide("SEMANAL" as TipoResumen, "VALOR_ACCIONES", delValor)).toBe(false);
    expect(claveCoincide("REGLAS", "VALOR_ACCIONES", delValor)).toBe(false);
    expect(claveCoincide("DIARIO", "ESPECIE_NOMBRE", new Set(palabrasClave(etiqueta("DIARIO", "ESPECIE_NOMBRE"))))).toBe(false);
  });

  it("sin ninguna palabra clave, no coincide", () => {
    expect(claveCoincide("DIARIO", "VALOR_ACCIONES", raices("el dato es"))).toBe(false);
    expect(claveCoincide("DIARIO", "VALOR_ACCIONES", new Set())).toBe(false);
  });

  it.each([
    ["DIARIO", "VALOR_ACCIONES", "el valor de las acciones del portafolio"],
    ["DIARIO", "VALOR_ACCIONES", "el valor de las acciones sin contar el fondo"],
    ["DIARIO", "CIERRE_ESPECIE", "la especie cerró en"],
    ["DIARIO", "TASA_TRM", "la TRM quedó en"],
    ["DIARIO", "CONCILIACION_NO_CUADRA", "la conciliación no cuadra al corte"],
    ["DIARIO", "CONCILIACION_CUADRA", "la conciliación cuadra al corte"],
    ["DIARIO", "GANANCIA_SIN_VENDER", "la ganancia sin vender"],
    ["REGLAS", "REGLA_DIAS_AL_PLAZO", "faltan para el plazo de la regla"],
    ["REGLAS", "REGLA_DISTANCIA", "la distancia al nivel de la regla"],
    ["ESCENARIOS", "ESCENARIO_CENTRAL_CORTO", "en el escenario central a corto plazo el valor quedaría en"],
  ] as const)("paráfrasis que pasa · %s %s «%s»", (tipo, clave, texto) => {
    expect(claveCoincide(tipo, clave, raices(texto))).toBe(true);
  });

  it.each([
    ["DIARIO", "CONCILIACION_NO_CUADRA", "la conciliación cuadra al corte"],
    ["DIARIO", "CONCILIACION_CUADRA", "la conciliación no cuadra al corte"],
    ["DIARIO", "VARIACION_DIA_VALOR", "el valor de las acciones"],
    ["DIARIO", "GANANCIA_TOTAL", "la ganancia sin vender"],
    ["DIARIO", "DIVIDENDOS_RECIBIDOS", "las comisiones pagadas"],
    ["DIARIO", "VALOR_ACCIONES", "el valor del fondo"],
    ["REGLAS", "REGLA_DIAS_AL_PLAZO", "el plazo de la regla"],
    ["REGLAS", "REGLA_NIVEL", "la distancia al nivel de la regla"],
    ["ESCENARIOS", "ESCENARIO_ALTO_CORTO", "el escenario bajo a corto plazo"],
    ["ESCENARIOS", "ESCENARIO_CENTRAL_MEDIO", "el escenario central a corto plazo"],
  ] as const)("etiqueta cambiada que falla · %s %s «%s»", (tipo, clave, texto) => {
    expect(claveCoincide(tipo, clave, raices(texto))).toBe(false);
  });
});

describe("el sujeto de un hecho de regla con ancla (E1b)", () => {
  /**
   * En `main` el sujeto siempre es el nombre de la especie; con E1b, un hecho de regla cita al ancla de su regla, y el
   * ancla puede no citar especie (regla de portafolio). Aquí se arma solo el mapa de hechos que lee `revisarEtiquetas`
   * (no un paquete): la regla con ancla sin especie no exige nombre; con especie, sí.
   */
  const reglas = paqueteFicticio("REGLAS");
  const base = reglas.hechos[0] as Hecho;
  const conId = (id: string, clave: string, unidad: Hecho["unidad"], sujeto?: string): Hecho =>
    ({ ...base, id, clave, unidad, ...(sujeto === undefined ? {} : { sujeto }) }) as unknown as Hecho;
  const porId: ReadonlyMap<string, Hecho> = new Map([
    conId("H01", "REGLA_PLAZO", "FECHA"),
    conId("H02", "REGLA_NIVEL", "PESOS", "H01"),
    conId("H03", "ESPECIE_NOMBRE", "NOMBRE"),
    conId("H04", "REGLA_NIVEL", "PESOS", "H03"),
  ].map((h) => [h.id, h]));
  const revisar = (texto: string): readonly string[] => {
    const atribucion = atribuir(clausulasDe(prepararTexto(texto).minusculas), (id) => porId.has(id) && !esNombre(porId.get(id)));
    return revisarEtiquetas(atribucion, porId, "REGLAS", new Set(citasDe(texto).map((c) => c.id))).map((h) => h.patron);
  };

  it("una cadena que no llega a una especie no exige nombre", () => {
    expect(revisar("Nivel de la regla {H02}.")).toEqual([]);
  });

  it("una cadena que llega a una especie exige su nombre en la frase", () => {
    expect(revisar("Nivel de la regla {H04}.")).toEqual(["ETIQUETA.SIN_SUJETO"]);
    expect(revisar("{H03}: nivel de la regla {H04}.")).toEqual([]);
  });

  it("el mapa de hechos del paquete real da lo mismo que el armado (control)", () => {
    expect(hechosPorId(reglas).size).toBe(reglas.hechos.length);
  });
});
