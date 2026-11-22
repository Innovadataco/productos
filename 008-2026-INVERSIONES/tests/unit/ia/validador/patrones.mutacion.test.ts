/**
 * Candado por mutación de cada patrón y de cada alternativa de cada patrón. Quitar un patrón, o una sola palabra de un
 * patrón (o un patrón y su ejemplo a la vez), pone esta prueba en rojo:
 * - el inventario literal de los ids, escrito aquí (no se lee de `src/`);
 * - un ejemplo por patrón que detecta SOLO ese patrón entre todas las listas, y que la lista sin ese patrón no detecta;
 * - por cada alternativa (cada palabra o frase del patrón), su ejemplo (la alternativa misma si es literal, o el de la
 *   tabla de abajo si es un fragmento de regex): el patrón lo detecta, y el patrón reconstruido SIN esa alternativa ya no;
 * - el cableado: `validarSalida` rechaza cada ejemplo de patrón y de alternativa, puesto en una frase válida, con el
 *   código de su lista.
 * Y ninguna etiqueta del catálogo dispara un patrón (la plantilla sin IA las usa tal cual).
 */
import { describe, expect, it } from "vitest";
import { CATALOGO } from "@/ia/catalogo";
import { TIPOS_RESUMEN } from "@/ia/contrato";
import type { CodigoValidador } from "@/ia/validador/codigos";
import { coincidencias, construirExpresion, formaDe, prepararTexto, type Patron, type PatronMarca } from "@/ia/validador/patron";
import { PATRONES_CIFRA_EN_PALABRAS, PATRONES_IDIOMA, PATRONES_MARCA, PATRONES_SIN_DATO } from "@/ia/validador/patrones-lengua";
import { PATRONES_PREDICCION, PATRONES_RECOMENDACION, PATRONES_TRATO } from "@/ia/validador/patrones-redaccion";
import { validarSalida } from "@/ia/validador/validar";
import { paqueteFicticio, salidaDe } from "./apoyo/salidas.ficticio";

/** Ejemplo de cada patrón, por id. El inventario es la lista de estas claves, en el orden de `src/`. */
const EJEMPLOS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  RECOMENDACION: {
    "RECOMENDACION.COMPRA": "compraría", "RECOMENDACION.VENDER": "venderla", "RECOMENDACION.VENTA": "la venta",
    "RECOMENDACION.MANTENER": "mantener", "RECOMENDACION.RECOMENDAR": "recomiendo", "RECOMENDACION.SUGERIR": "sugiero",
    "RECOMENDACION.ACONSEJAR": "aconsejo", "RECOMENDACION.DEBER": "debería", "RECOMENDACION.CONVENIR": "conviene",
    "RECOMENDACION.OBLIGACION": "hay que", "RECOMENDACION.MOMENTO": "buen momento", "RECOMENDACION.OPORTUNIDAD": "oportunidad",
    "RECOMENDACION.APROVECHAR": "aprovechar", "RECOMENDACION.TOMAR_GANANCIAS": "tome utilidades", "RECOMENDACION.AJUSTAR": "reduzca",
    "RECOMENDACION.REBALANCEAR": "rebalancee", "RECOMENDACION.DIVERSIFICAR": "diversifique", "RECOMENDACION.INVERTIR": "invierta",
    "RECOMENDACION.ADQUIRIR": "adquiera", "RECOMENDACION.SALIR": "liquide", "RECOMENDACION.OBJETIVO": "precio objetivo",
    "RECOMENDACION.SENAL": "señal", "RECOMENDACION.PONDERAR": "sobreponderar", "RECOMENDACION.VALORACION": "barata",
    "RECOMENDACION.CONSEJO": "considere", "RECOMENDACION.ORDEN": "stop loss", "RECOMENDACION.EXTRANJERA": "buy",
  },
  PREDICCION: {
    "PREDICCION.FUTURO_SIMPLE": "repuntará", "PREDICCION.FUTURO_SIN_TILDE": "subira", "PREDICCION.IR_A": "va a subir",
    "PREDICCION.ESPERAR": "se espera", "PREDICCION.PREVER": "se prevé", "PREDICCION.PRONOSTICO": "pronóstico",
    "PREDICCION.GARANTIA": "garantiza", "PREDICCION.SIN_RIESGO": "sin riesgo", "PREDICCION.CERTEZA": "sin duda",
    "PREDICCION.PROBABLE": "probablemente", "PREDICCION.TENDENCIA": "alcista", "PREDICCION.FUTURO_TIEMPO": "próximamente",
  },
  TRATO: {
    "TRATO.TU": "tu", "TRATO.TE": "contigo", "TRATO.VOSOTROS": "vosotros", "TRATO.VOS": "vos", "TRATO.VOSEO_VERBO": "tenés",
    "TRATO.TU_VERBO": "tienes", "TRATO.TU_IMPERATIVO": "revisa",
  },
  CIFRA_EN_PALABRAS: {
    "CIFRA_EN_PALABRAS.UNIDADES": "tres", "CIFRA_EN_PALABRAS.DECENAS": "quince", "CIFRA_EN_PALABRAS.CENTENAS": "doscientos",
    "CIFRA_EN_PALABRAS.MILES": "millones", "CIFRA_EN_PALABRAS.ORDINALES": "segundo", "CIFRA_EN_PALABRAS.FRACCIONES": "mitad",
    "CIFRA_EN_PALABRAS.COLECTIVOS": "docena", "CIFRA_EN_PALABRAS.PORCIENTO": "porciento", "CIFRA_EN_PALABRAS.MESES": "marzo",
    "CIFRA_EN_PALABRAS.DIAS_SEMANA": "lunes", "CIFRA_EN_PALABRAS.DIAS_RELATIVOS": "ayer", "CIFRA_EN_PALABRAS.APROXIMADOR": "casi {H01}",
    "CIFRA_EN_PALABRAS.UNO": "uno más", "CIFRA_EN_PALABRAS.ROMANO": "xii",
  },
  IDIOMA: {
    "IDIOMA.INGLES": "the", "IDIOMA.PORTUGUES": "também", "IDIOMA.FRANCES": "avec", "IDIOMA.ITALIANO": "della",
  },
  MARCA: {
    "DIRECCION.SUBE_VERBO": "subió", "DIRECCION.SUBE_SUSTANTIVO": "alza", "DIRECCION.BAJA_VERBO": "bajó",
    "DIRECCION.BAJA_SUSTANTIVO": "descenso", "DIRECCION.IGUAL": "se mantuvo", "CERCANIA.CERCA": "cerca",
    "CERCANIA.LEJOS": "lejos", "FRESCURA.HOY": "hoy",
  },
  SIN_DATO: {
    "DIRECCION.COMPARATIVO": "mayor", "DIRECCION.NEGADA": "sin subir",
  },
};

/** Las raíces de movimiento que una negación da vuelta, cada una con su ejemplo (una alternativa por raíz en src). */
const NEGACION = "(?:no|sin|nunca|ni|tampoco|dejo de|dejaron de)(?: \\p{L}+){0,2} ";
const NEGADOS_CON_EJEMPLO: Readonly<Record<string, string>> = Object.fromEntries(([
  ["sub", "no subió"], ["baj", "dejó de bajar"], ["ca[eiy]", "no cayó"], ["crec", "no creció"], ["aument", "no aumentó"], ["dismin", "no disminuyó"],
  ["descend", "no descendió"], ["retroced", "no retrocedió"], ["perd", "no perdió"], ["gan(?!anc)", "no ganó"], ["avanz", "no avanzó"],
  ["repunt", "no repuntó"], ["mejor", "no mejoró"], ["empeor", "no empeoró"], ["valoriz", "no se valorizó"], ["desvaloriz", "no se desvalorizó"],
  ["recuper", "no se ha recuperado"], ["ascend", "no ascendió"], ["escal", "no escaló"], ["dispar", "no se disparó"], ["desplom", "no se desplomó"],
  ["hund", "no se hundió"], ["ced", "no cedió"], ["fortalec", "no se fortaleció"], ["debilit", "no se debilitó"], ["super", "no superó"],
  ["rebas", "no rebasó"], ["salt", "no saltó"],
] as const).map(([raiz, ejemplo]) => [`${NEGACION}${raiz}\\p{L}*`, ejemplo]));

/** El ejemplo de cada alternativa que no es una palabra o frase literal (un fragmento de regex). */
const EJEMPLOS_DE_FRAGMENTO: Readonly<Record<string, string>> = {
  "compr(?!ob|end|ens|om|im|esi|esor)\\p{L}*": "compraríamos",
  "vend\\p{L}*": "venderlas",
  "ventas?": "ventas",
  "aprovech\\p{L}*": "aprovechen",
  "adqui[er]\\p{L}*": "adquirir",
  "(?:tome|tomar|toma de|asegure|asegurar) (?:ganancias|utilidades)": "asegure ganancias",
  "momento de (?:invertir|entrar|salir)": "momento de entrar",
  "\\p{L}+r(?:á|án|ás|é)": "subirán",
  "(?!extremos|supremos)\\p{L}{2,}remos": "veremos",
  "(?:va|van|vamos|iba|iban|ira|iran|iria|irian|apunta|apuntan|tiende|tienden) a \\p{L}+(?:ar|er|ir)": "tiende a bajar",
  "dieci\\p{L}+": "dieciocho",
  "veinti\\p{L}+": "veintitrés",
  "(?:doscient|trescient|cuatrocient|quinient|seiscient|setecient|ochocient|novecient)\\p{L}*": "quinientos",
  "(?:milesim|centesim|undecim|duodecim|vigesim|trigesim)\\p{L}*": "milésima",
  "(?:casi|unos|unas|alrededor de|aproximadamente|mas de|menos de|apenas) \\{h[0-9]{2}\\}": "más de {H01}",
  "(?=[ivxlcdm]{2,}(?![\\p{L}\\p{N}]))m{0,3}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})": "mcmxc",
  ...NEGADOS_CON_EJEMPLO,
};

const LISTAS: Readonly<Record<string, { readonly patrones: readonly Patron[]; readonly codigo: CodigoValidador }>> = {
  RECOMENDACION: { patrones: PATRONES_RECOMENDACION, codigo: "RECOMENDACION" },
  PREDICCION: { patrones: PATRONES_PREDICCION, codigo: "PREDICCION" },
  TRATO: { patrones: PATRONES_TRATO, codigo: "TRATO" },
  CIFRA_EN_PALABRAS: { patrones: PATRONES_CIFRA_EN_PALABRAS, codigo: "CIFRA_EN_PALABRAS" },
  IDIOMA: { patrones: PATRONES_IDIOMA, codigo: "IDIOMA" },
  MARCA: { patrones: PATRONES_MARCA, codigo: "DIRECCION_CONTRADICE" },
  SIN_DATO: { patrones: PATRONES_SIN_DATO, codigo: "DIRECCION_CONTRADICE" },
};

const LITERAL = /^[\p{L} ]+$/u;
const TODOS: readonly Patron[] = Object.values(LISTAS).flatMap((l) => l.patrones);
const CASOS = Object.entries(EJEMPLOS).flatMap(([lista, ejemplos]) => Object.entries(ejemplos).map(([id, ejemplo]) => ({ lista, id, ejemplo })));
const ALTERNATIVAS = Object.entries(LISTAS).flatMap(([lista, { patrones }]) => patrones.flatMap((p) => p.alternativas.map((alternativa) => ({
  lista, id: p.id, alternativa, ejemplo: LITERAL.test(alternativa) ? alternativa : EJEMPLOS_DE_FRAGMENTO[alternativa],
}))));

/** ¿Detecta el patrón (o el patrón reconstruido con otras alternativas) el texto? Sin alternativas, nada. */
function detecta(p: Patron, alternativas: readonly string[], texto: string): boolean {
  return alternativas.length > 0 && construirExpresion(alternativas, p.antes).test(formaDe(prepararTexto(texto), p.sobre));
}

/** El ejemplo puesto en una frase válida, de modo que solo lo rechace su lista (las marcas, contra un hecho que las contradice). */
function plantillaPara(lista: string, p: Patron, ejemplo: string): string {
  if (lista !== "MARCA") return `El valor de las acciones subió a {VALOR_ACCIONES}, ${ejemplo}.`;
  const marca = (p as PatronMarca).marca;
  return marca.campo === "direccion" && marca.valor === "BAJA"
    ? `El valor de las acciones, ${ejemplo}, es {VALOR_ACCIONES}.`
    : `El valor de las acciones subió a {VALOR_ACCIONES} y la ganancia total, ${ejemplo}, es {GANANCIA_TOTAL}.`;
}

function rechazaConSuCodigo(lista: string, p: Patron, ejemplo: string): void {
  const paquete = paqueteFicticio("DIARIO");
  const resultado = validarSalida(salidaDe(paquete, plantillaPara(lista, p, ejemplo)), paquete);
  expect(resultado.ok).toBe(false);
  if (resultado.ok) return;
  expect(resultado.motivos).toContain(LISTAS[lista]?.codigo);
  expect(resultado.hallazgos.map((h) => h.patron)).toContain(p.id);
}

describe("inventario", () => {
  it.each(Object.keys(LISTAS))("%s: los ids de src son exactamente los del inventario, en orden y sin dígitos", (lista) => {
    const ids = (LISTAS[lista]?.patrones ?? []).map((p) => p.id);
    expect(ids).toEqual(Object.keys(EJEMPLOS[lista] ?? {}));
    for (const id of ids) expect(id).toMatch(/^[A-Z_]+\.[A-Z_]+$/);
  });

  it("cada patrón está congelado, sin las banderas g ni y (no guardan estado), con la bandera u y su expresión reconstruible", () => {
    expect(TODOS.length).toBeGreaterThan(0);
    for (const p of TODOS) {
      expect(Object.isFrozen(p)).toBe(true);
      expect(Object.isFrozen(p.alternativas)).toBe(true);
      expect(p.patron.flags).not.toMatch(/[gy]/);
      expect(p.patron.flags).toContain("u");
      expect(p.patron.source).toBe(construirExpresion(p.alternativas, p.antes).source);
    }
    for (const lista of Object.values(LISTAS)) expect(Object.isFrozen(lista.patrones)).toBe(true);
  });

  it("cada fragmento de regex tiene su ejemplo, y la tabla no tiene ejemplos de más", () => {
    const fragmentos = ALTERNATIVAS.filter((a) => !LITERAL.test(a.alternativa)).map((a) => a.alternativa);
    expect([...fragmentos].sort()).toEqual(Object.keys(EJEMPLOS_DE_FRAGMENTO).sort());
  });

  it("construirExpresion sin alternativas es un defecto del código", () => {
    expect(() => construirExpresion([], "")).toThrow(RangeError);
  });
});

describe.each(CASOS)("$id", ({ lista, id, ejemplo }) => {
  const patrones = LISTAS[lista]?.patrones ?? [];

  it("su ejemplo lo detecta solo ese patrón, entre todas las listas", () => {
    expect(coincidencias(ejemplo, TODOS)).toEqual([id]);
  });

  it("mutación: la lista sin ese patrón ya no detecta su ejemplo", () => {
    const mutada = patrones.filter((p) => p.id !== id);
    expect(mutada).toHaveLength(patrones.length - 1);
    expect(coincidencias(ejemplo, mutada)).toEqual([]);
  });

  it("cableado: validarSalida rechaza el ejemplo con el código de su lista", () => {
    rechazaConSuCodigo(lista, patrones.find((p) => p.id === id) as Patron, ejemplo);
  });
});

describe.each(ALTERNATIVAS)("$id · «$alternativa»", ({ lista, id, alternativa, ejemplo }) => {
  const p = (LISTAS[lista]?.patrones ?? []).find((x) => x.id === id) as Patron;

  it("el patrón detecta el ejemplo de la alternativa; sin esa alternativa, ya no (mutación)", () => {
    expect(ejemplo).toBeDefined();
    expect(detecta(p, p.alternativas, ejemplo as string)).toBe(true);
    expect(detecta(p, p.alternativas.filter((a) => a !== alternativa), ejemplo as string)).toBe(false);
  });

  it("cableado: validarSalida lo rechaza con el código de su lista", () => {
    rechazaConSuCodigo(lista, p, ejemplo as string);
  });
});

describe("las exclusiones de los fragmentos (lo que NO es una recomendación, una predicción ni una negación)", () => {
  it.each([
    ["comprobar", PATRONES_RECOMENDACION], ["comprender", PATRONES_RECOMENDACION], ["comprensión", PATRONES_RECOMENDACION],
    ["compromiso", PATRONES_RECOMENDACION], ["comprimido", PATRONES_RECOMENDACION], ["compresión", PATRONES_RECOMENDACION],
    ["compresor", PATRONES_RECOMENDACION], ["ganancia sin vender", PATRONES_RECOMENDACION], ["ganancia por ventas", PATRONES_RECOMENDACION],
    ["extremos", PATRONES_PREDICCION], ["supremos", PATRONES_PREDICCION], ["sin ganancia", PATRONES_SIN_DATO], ["no cambió", PATRONES_SIN_DATO],
    ["sin variación", PATRONES_SIN_DATO],
  ] as const)("«%s» no dispara su lista", (texto, lista) => {
    expect(coincidencias(texto, lista)).toEqual([]);
  });
});

describe("las etiquetas del catálogo no disparan ningún patrón", () => {
  it.each(TIPOS_RESUMEN)("%s", (tipo) => {
    for (const entrada of Object.values(CATALOGO[tipo])) {
      expect([entrada.etiqueta, coincidencias(entrada.etiqueta, TODOS)]).toEqual([entrada.etiqueta, []]);
    }
  });
});
