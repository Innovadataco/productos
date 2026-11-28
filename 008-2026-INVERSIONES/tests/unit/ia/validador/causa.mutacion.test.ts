/**
 * Candado por mutación de los patrones de CAUSA (molde: `patrones.mutacion.test.ts`):
 * - el inventario literal de los ids (no se lee de `src/`);
 * - un ejemplo por patrón que lo detecta SOLO a él, y que la lista sin ese patrón no detecta;
 * - por cada alternativa, su ejemplo: el patrón lo detecta y, reconstruido sin esa alternativa, ya no;
 * - el cableado: `validarSalida` rechaza cada ejemplo con CAUSA, en una frase del DIARIO;
 * - las exenciones (lo que NO es una causa) y los casi iguales (lo que SÍ lo es);
 * - 0 falsos positivos en todo el texto que el sistema escribe por sí mismo.
 */
import { describe, expect, it } from "vitest";
import { CATALOGO } from "@/ia/catalogo";
import { TIPOS_RESUMEN } from "@/ia/contrato";
import { casosInventados } from "@/ia/evaluacion/casos";
import { construirPaquete } from "@/ia/paquete";
import { CLAVES_DE_ESPECIE_DIARIO, moldeDiario } from "@/ia/prompts/moldes-diario";
import { leerSalida } from "@/ia/validador/leer";
import { coincidencias, construirExpresion, formaDe, prepararTexto, type Patron } from "@/ia/validador/patron";
import { PATRONES_CAUSA } from "@/ia/validador/patrones-causa";
import { salidaDePlantilla } from "@/ia/validador/plantilla";
import { CONDICIONALES, PALABRAS_BASE } from "@/ia/validador/vocabulario";
import { validarSalida } from "@/ia/validador/validar";
import { crearPrng } from "@/proyecciones/prng";
import { entradaAlAzar } from "../apoyo/aleatorio.ficticio";
import { FRASES_VALIDAS, frase, paqueteFicticio, salidaDe } from "./apoyo/salidas.ficticio";

const SEMILLA_AZAR = 20270317;
const PAQUETES_AL_AZAR = 300;

const EJEMPLOS: Readonly<Record<string, string>> = {
  "CAUSA.POR": "por el mercado",
  "CAUSA.DESDE": "desde el cierre",
  "CAUSA.CON": "con la tasa",
  "CAUSA.SIN": "sin la tasa",
  "CAUSA.CONECTOR": "porque la tasa",
  "CAUSA.TRANSITIVO": "la tasa subió la ganancia total",
  "CAUSA.TRANSITIVO_BAJO": "la tasa bajó la ganancia total",
};

const FIN = "(?![\\p{L}\\p{N}])";

/** El ejemplo de cada alternativa que no es una palabra o frase literal (un fragmento de regex). */
const EJEMPLOS_DE_FRAGMENTO: Readonly<Record<string, string>> = {
  [`por(?! debajo de lo aportado${FIN})(?!(?<=ganancias? por) ventas${FIN})(?!(?<=decretad[oa]s? por) accion(?:es)?${FIN})`]: "por el mercado",
  [`con(?!(?<=especies? con) cierres? atrasad[oa]s?${FIN})(?!(?<=valor con) riesgo modelado${FIN})`]: "con la tasa",
  [`sin(?!(?<=ganancia sin) vender${FIN})(?!(?<=especies? sin) precio${FIN})(?!(?<=rentabilidad sin) vender${FIN})(?!(?<=regla sin) cierre al dia${FIN})`]: "sin la tasa",
  "desde(?!(?<=vigentes? desde)(?: \\{h[0-9]{2}\\}|$))": "desde el cierre",
  "debid[oa]s? al?": "debido al",
  "a causa del?": "a causa de",
  "gracias al?": "gracias al",
  "a raiz del?": "a raíz del",
  "se deb(?:e|en|io|ieron) al?": "se debe al",
  "atribu\\p{L}*": "atribuye",
  "impulsad\\p{L}*": "impulsado",
  "motivad\\p{L}*": "motivado",
  "provocad\\p{L}*": "provocado",
  "causad\\p{L}*": "causada",
  "luego del?": "luego de",
  "despues del?": "después del",
  "frente al?": "frente a",
  "falta del?": "la falta del cierre",
  // El fragmento del causativo, escrito aparte de `src/` (verbo de marca + espacio + adverbio opcional + determinante ante una palabra).
  [
    "(?:subio|subieron|sube|suben|subiendo|ha\\u0020subido|han\\u0020subido|aumento|aumentaron|aumenta|aumentan|crecio|crecieron|crece|crecen|" +
    "avanzo|avanzaron|avanza|avanzan|gano|ganaron|repunto|repuntaron|mejoro|mejoraron|mejora|mejoran|incremento|incrementaron|ascendio|" +
    "ascendieron|asciende|escalo|escalaron|salto|saltaron|elevo|elevaron|bajaron|baja|bajan|bajando|ha\\u0020bajado|han\\u0020bajado|" +
    "cayo|cayeron|cae|caen|cayendo|descendio|descendieron|desciende|disminuyo|disminuyeron|disminuye|retrocedio|retrocedieron|retrocede|" +
    "perdio|perdieron|pierde|pierden|empeoro|empeora|empeoran|redujo|redujeron|cedio|cedieron|mantuvo|mantuvieron|mantiene|mantienen|" +
    "movio|empujo|llevo|dejo)\\u0020(?:(?:tambien|ademas|asimismo|aun|todavia)\\u0020)?" +
    "(?:el|la|los|las|lo|su|sus|un|una|unos|unas|este|esta|estos|estas|ese|esa|esos|esas|otro|otra|otros|otras|todo|toda|todos|todas|cada)" +
    "(?=\\u0020\\p{L})"
  ]: "la tasa subió la ganancia total",
  // El fragmento de «bajó» y «bajo» (sobre minúsculas: la tilde cuenta; «bajo» sin tilde no vale tras «escenario(s)», «bájo» sí). Cada vocal del
  // verbo, del adverbio y del determinante acepta su tilde (H10): el vocabulario compara plegado.
  [
    "(?:b[aá]jó|bájo|(?<!escenarios?\\u0020)bajo)\\u0020(?:(?:t[aá]mb[ií][eé]n|[aá]d[eé]m[aá]s|[aá]s[ií]m[ií]sm[oó]|[aá][uúü]n|t[oó]d[aá]v[ií][aá])\\u0020)?" +
    "(?:[eé]l|l[aá]|l[oó]s|l[aá]s|l[oó]|s[uúü]|s[uúü]s|[uúü]n|[uúü]n[aá]|[uúü]n[oó]s|[uúü]n[aá]s|[eé]st[eé]|[eé]st[aá]|[eé]st[oó]s|[eé]st[aá]s|[eé]s[eé]|[eé]s[aá]|[eé]s[oó]s|[eé]s[aá]s|[oó]tr[oó]|[oó]tr[aá]|[oó]tr[oó]s|[oó]tr[aá]s|t[oó]d[oó]|t[oó]d[aá]|t[oó]d[oó]s|t[oó]d[aá]s|c[aá]d[aá])" +
    "(?=\\u0020\\p{L})"
  ]: "la tasa bajó la ganancia total",
};

const LITERAL = /^[\p{L} ]+$/u;
const CASOS = Object.entries(EJEMPLOS).map(([id, ejemplo]) => ({ id, ejemplo }));
const ALTERNATIVAS = PATRONES_CAUSA.flatMap((p) => p.alternativas.map((alternativa) => ({
  id: p.id, alternativa, ejemplo: LITERAL.test(alternativa) ? alternativa : EJEMPLOS_DE_FRAGMENTO[alternativa],
})));

function detecta(p: Patron, alternativas: readonly string[], texto: string): boolean {
  return alternativas.length > 0 && construirExpresion(alternativas, p.antes).test(formaDe(prepararTexto(texto), p.sobre));
}

function rechazaConCausa(id: string, ejemplo: string): void {
  const paquete = paqueteFicticio("DIARIO");
  const r = validarSalida(salidaDe(paquete, `El valor de las acciones subió a {VALOR_ACCIONES}, ${ejemplo}.`), paquete);
  expect(r.ok).toBe(false);
  if (r.ok) return;
  expect(r.motivos).toContain("CAUSA");
  expect(r.hallazgos.map((h) => h.patron)).toContain(id);
}

describe("inventario", () => {
  it("los ids de src son exactamente los del inventario, en orden y sin dígitos", () => {
    const ids = PATRONES_CAUSA.map((p) => p.id);
    expect(ids).toEqual(Object.keys(EJEMPLOS));
    for (const id of ids) expect(id).toMatch(/^[A-Z_]+\.[A-Z_]+$/);
  });

  it("cada patrón está congelado, sin las banderas g ni y, con la bandera u y su expresión reconstruible", () => {
    expect(PATRONES_CAUSA.length).toBeGreaterThan(0);
    expect(Object.isFrozen(PATRONES_CAUSA)).toBe(true);
    for (const p of PATRONES_CAUSA) {
      expect(Object.isFrozen(p)).toBe(true);
      expect(Object.isFrozen(p.alternativas)).toBe(true);
      expect(p.patron.flags).not.toMatch(/[gy]/);
      expect(p.patron.flags).toContain("u");
      expect(p.patron.source).toBe(construirExpresion(p.alternativas, p.antes).source);
    }
  });

  it("cada fragmento de regex tiene su ejemplo, y la tabla no tiene ejemplos de más", () => {
    const fragmentos = ALTERNATIVAS.filter((a) => !LITERAL.test(a.alternativa)).map((a) => a.alternativa);
    expect([...fragmentos].sort()).toEqual(Object.keys(EJEMPLOS_DE_FRAGMENTO).sort());
  });
});

describe.each(CASOS)("$id", ({ id, ejemplo }) => {
  it("su ejemplo lo detecta solo ese patrón", () => {
    expect(coincidencias(ejemplo, PATRONES_CAUSA)).toEqual([id]);
  });

  it("mutación: la lista sin ese patrón ya no detecta su ejemplo", () => {
    const mutada = PATRONES_CAUSA.filter((p) => p.id !== id);
    expect(mutada).toHaveLength(PATRONES_CAUSA.length - 1);
    expect(coincidencias(ejemplo, mutada)).toEqual([]);
  });

  it("cableado: DIARIO → CAUSA", () => {
    rechazaConCausa(id, ejemplo);
  });
});

describe.each(ALTERNATIVAS)("$id · «$alternativa»", ({ id, alternativa, ejemplo }) => {
  const p = PATRONES_CAUSA.find((x) => x.id === id) as Patron;

  it("el patrón detecta el ejemplo de la alternativa; sin ella, ya no (mutación)", () => {
    expect(ejemplo).toBeDefined();
    expect(detecta(p, p.alternativas, ejemplo as string)).toBe(true);
    expect(detecta(p, p.alternativas.filter((a) => a !== alternativa), ejemplo as string)).toBe(false);
  });

  it("cableado: validarSalida lo rechaza con CAUSA", () => {
    rechazaConCausa(id, ejemplo as string);
  });
});

describe("exenciones: lo que NO es una causa", () => {
  it.each([
    "la ganancia por ventas", "las ganancias por ventas", "dividendo decretado por acción", "dividendos decretados por acciones",
    "queda por debajo de lo aportado", "regla del plan vigente desde {H01}", "las reglas vigentes desde {H01}", "regla del plan vigente desde",
    "especies con cierre atrasado", "parte del valor con riesgo modelado",
  ])("«%s» no dispara CAUSA", (texto) => {
    expect(coincidencias(texto, PATRONES_CAUSA)).toEqual([]);
  });
});

describe("casi iguales: lo que SÍ es una causa", () => {
  it.each([
    ["quedaría por debajo de {H03}", "CAUSA.POR"],
    ["subió por ventas", "CAUSA.POR"],
    ["con cierre atrasado, el valor es {H01}", "CAUSA.CON"],
    ["especies con la tasa", "CAUSA.CON"],
    ["valor con el mercado", "CAUSA.CON"],
    ["desde el cierre", "CAUSA.DESDE"],
    ["regla vigente y desde el cierre", "CAUSA.DESDE"],
    ["regla vigente desde el cierre", "CAUSA.DESDE"],
    ["regla vigente desde el cierre {H01}", "CAUSA.DESDE"],
    ["sin la ganancia por ventas, la ganancia total es {H01}", "CAUSA.SIN"],
    ["sin vender, el valor es {H01}", "CAUSA.SIN"],
    ["ganancia sin la tasa", "CAUSA.SIN"],
    ["especies sin cierre", "CAUSA.SIN"],
    ["regla sin precio", "CAUSA.SIN"],
    ["subió; es que la tasa bajó", "CAUSA.CONECTOR"],
  ] as const)("«%s» dispara %s", (texto, id) => {
    expect(coincidencias(texto, PATRONES_CAUSA)).toContain(id);
  });
});

describe("0 falsos positivos en el texto que el sistema escribe por sí mismo", () => {
  const textosDe = (salida: string): readonly string[] => (leerSalida(salida)?.frases ?? []).map((f) => f.texto);
  const prng = crearPrng(SEMILLA_AZAR);
  const alAzar = Array.from({ length: PAQUETES_AL_AZAR }, () => textosDe(salidaDePlantilla(construirPaquete(entradaAlAzar(prng))))).flat();
  const CORPUS: Readonly<Record<string, readonly string[]>> = {
    "etiquetas de TIPOS_RESUMEN": TIPOS_RESUMEN.flatMap((tipo) => Object.values(CATALOGO[tipo]).map((e) => e.etiqueta)),
    FRASES_VALIDAS: TIPOS_RESUMEN.flatMap((tipo) => FRASES_VALIDAS[tipo].map((plantilla) => frase(paqueteFicticio(tipo), plantilla).texto)),
    "plantilla de los casos inventados": casosInventados().flatMap((c) => textosDe(salidaDePlantilla(c.paquete))),
    "plantilla de paquetes al azar": alAzar,
    "moldes del DIARIO": CLAVES_DE_ESPECIE_DIARIO.map((clave) => moldeDiario(clave)),
    PALABRAS_BASE: [...PALABRAS_BASE],
    CONDICIONALES: [...CONDICIONALES],
  };

  it("los corpus no están vacíos", () => {
    for (const [nombre, textos] of Object.entries(CORPUS)) expect([nombre, textos.length > 0]).toEqual([nombre, true]);
    expect(CORPUS["plantilla de paquetes al azar"]?.length).toBeGreaterThan(PAQUETES_AL_AZAR);
  });

  it.each(Object.keys(EJEMPLOS))("%s: ningún texto propio lo dispara", (id) => {
    const falsos = Object.entries(CORPUS).flatMap(([nombre, textos]) =>
      textos.filter((t) => coincidencias(t, PATRONES_CAUSA).includes(id)).map((t) => `${nombre}: ${t}`));
    expect(falsos).toEqual([]);
  });

  it("control positivo: el detector sí ve una causa dentro de un corpus", () => {
    expect(["la ganancia total es {H01}", "subió por la tasa"].filter((t) => coincidencias(t, PATRONES_CAUSA).length > 0)).toEqual(["subió por la tasa"]);
  });
});
