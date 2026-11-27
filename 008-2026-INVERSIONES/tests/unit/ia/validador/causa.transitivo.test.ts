/**
 * Frente 3a de CAUSA: el causativo transitivo («la tasa bajó la ganancia total», «los dividendos subieron el valor de las
 * acciones») atribuye un hecho a otro con un verbo de marca seguido de un determinante. Hoy publica en el DIARIO.
 * Y la familia nominal de «falta»: «la falta de dividendos…» es el mismo contrafactual que «a falta de». Datos inventados.
 */
import { describe, expect, it } from "vitest";
import { entradaDeCatalogo, type ClaveDiario } from "@/ia/catalogo";
import type { EntradaPaquete, IdHecho } from "@/ia/contrato";
import { construirPaquete } from "@/ia/paquete";
import { presentar } from "@/ia/presentar";
import { coincidencias } from "@/ia/validador/patron";
import { PATRONES_CAUSA } from "@/ia/validador/patrones-causa";
import { PATRONES_MARCA } from "@/ia/validador/patrones-lengua";
import { validarSalida } from "@/ia/validador/validar";
import { hecho } from "../apoyo/hechos.ficticio";
import { salidaDe } from "./apoyo/salidas.ficticio";

const AYER = "2027-03-16";
const de = (id: IdHecho, clave: ClaveDiario, valor: string, extra: Record<string, unknown> = {}) =>
  hecho(id, clave, valor, presentar(valor, entradaDeCatalogo("DIARIO", clave)!.unidad), extra);

/** Un DIARIO inventado con las tasas y los componentes de la ganancia, para frases que solo usan el vocabulario. */
const ENTRADA: EntradaPaquete<"DIARIO"> = {
  tipo: "DIARIO", hoy: "2027-03-17", versionesCalculo: { tablero: "tablero-ficticio-v7" }, avisos: [],
  hechos: [
    de("H01", "ESPECIE_NOMBRE", "FICTICIA-OMEGA"),
    de("H02", "VALOR_ACCIONES", "37911.47", { direccion: "SUBE", obligatorio: true }),
    de("H03", "GANANCIA_TOTAL", "-1237.53", { direccion: "BAJA", calidad: "CALCULADO" }),
    de("H04", "TASA_TPM", "7.25", { direccion: "BAJA" }),
    de("H05", "TASA_TRM", "4123.45", { direccion: "SUBE" }),
    de("H06", "GANANCIA_POR_VENTAS", "-913.31", { direccion: "BAJA" }),
    de("H07", "DIVIDENDOS_RECIBIDOS", "211.19", { direccion: "SUBE" }),
  ].map((h) => ({ ...h, fecha: AYER })),
};
const PAQUETE = construirPaquete(ENTRADA);

const DIARIO = [
  "La tasa de política monetaria (TPM) {TASA_TPM} bajó la ganancia total a {GANANCIA_TOTAL}.",
  "Los dividendos recibidos {DIVIDENDOS_RECIBIDOS} subieron el valor de las acciones a {VALOR_ACCIONES}.",
  "La falta de dividendos bajó la ganancia total a {GANANCIA_TOTAL}.",
  "La ganancia por ventas {GANANCIA_POR_VENTAS} bajó la ganancia total a {GANANCIA_TOTAL}.",
  "La tasa de cambio representativa del mercado (TRM) {TASA_TRM} subió el valor de las acciones a {VALOR_ACCIONES}.",
  "La falta del cierre bajó la ganancia total a {GANANCIA_TOTAL}.",
] as const;

describe("causativo transitivo en el DIARIO: CAUSA.TRANSITIVO", () => {
  it.each(DIARIO)("«%s» se rechaza con CAUSA.TRANSITIVO", (plantilla) => {
    const r = validarSalida(salidaDe(PAQUETE, plantilla), PAQUETE);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivos).toContain("CAUSA");
    expect(r.hallazgos.map((h) => h.patron)).toContain("CAUSA.TRANSITIVO");
  });
});

const VERBOS = [
  "subió", "bajó", "subieron", "bajaron", "sube", "suben", "baja", "bajan", "aumentó", "aumentaron", "cayó", "cayeron",
  "redujo", "redujeron", "elevó", "elevaron", "movió", "empujó", "llevó", "dejó",
] as const;
const DETERMINANTES = ["el", "la", "los", "las", "lo", "su", "sus", "un", "una", "este", "esta", "estos", "estas"] as const;

describe("el patrón por forma, en los tres tipos de texto", () => {
  it.each([
    "el precio de cierre bajó la distancia al nivel de la regla", "el nivel de la regla subió la distancia a {H01}",
    "la volatilidad anual histórica bajó el escenario central a corto plazo", "la historia dejó el escenario central en {H01}",
    "la tasa {H05} bajó la ganancia total", "los dividendos subieron el valor",
  ])("«%s» dispara CAUSA.TRANSITIVO", (texto) => {
    expect(coincidencias(texto, PATRONES_CAUSA)).toContain("CAUSA.TRANSITIVO");
  });

  it.each(VERBOS)("el verbo «%s» seguido de un determinante dispara", (verbo) => {
    expect(coincidencias(`la tasa ${verbo} la ganancia total`, PATRONES_CAUSA)).toContain("CAUSA.TRANSITIVO");
  });

  it.each(DETERMINANTES)("el determinante «%s» tras el verbo dispara", (det) => {
    expect(coincidencias(`la tasa bajó ${det} valor`, PATRONES_CAUSA)).toContain("CAUSA.TRANSITIVO");
  });

  it("sin tildes y en mayúsculas también", () => {
    expect(coincidencias("La tasa BAJO LA ganancia total", PATRONES_CAUSA)).toContain("CAUSA.TRANSITIVO");
  });
});

describe("vigilancia: lo intransitivo y lo propio no es causa transitiva", () => {
  it.each([
    "El valor de las acciones subió a {H03} y la ganancia total bajó a {H04}.", "la ganancia total bajó a {H04}", "el valor subió",
    "a la baja", "la tasa bajó y el valor subió", "el valor de la especie bajó {H02}", "subieron {H01} y {H02}", "el valor subió, la ganancia total es {H03}", "la tasa bajó; el valor es {H02}", "la tasa bajó (la ganancia total es {H03})",
  ])("«%s» no dispara CAUSA.TRANSITIVO", (texto) => {
    expect(coincidencias(texto, PATRONES_CAUSA)).not.toContain("CAUSA.TRANSITIVO");
  });
});

describe("la familia nominal de «falta»: «falta de(l)» es causa", () => {
  it.each([
    "la falta de dividendos", "la falta del cierre", "Falta de ventas", "por la falta de dividendos", "a falta de la ganancia por ventas",
    "A falta del cierre",
  ])("«%s» da CAUSA.CONECTOR", (texto) => {
    expect(coincidencias(texto, PATRONES_CAUSA)).toContain("CAUSA.CONECTOR");
  });

  it("el caso del MEDIO publica hoy: «A falta de la ganancia por ventas, la ganancia total bajó…»", () => {
    const r = validarSalida(
      salidaDe(PAQUETE, "A falta de la ganancia por ventas {GANANCIA_POR_VENTAS}, la ganancia total bajó a {GANANCIA_TOTAL}."), PAQUETE);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.hallazgos.map((h) => h.patron)).toContain("CAUSA.CONECTOR");
  });

  it.each(["faltan {H01} para el plazo", "falta el cierre", "el dato que falta", "hay datos faltantes", "a faltas", "faltas de ortografía"])(
    "«%s» no dispara CAUSA", (texto) => {
      expect(coincidencias(texto, PATRONES_CAUSA)).toEqual([]);
    });
});

/** Frente 3a': el cierre. Los verbos de marca del vocabulario, los determinantes y adverbios de la base, y las dos exenciones. */
const CAUSA_EN = (r: ReturnType<typeof validarSalida>): readonly string[] => (r.ok ? [] : r.hallazgos.map((h) => h.patron));

describe("H1: los verbos de marca del vocabulario que no estaban en la lista dan CAUSA.TRANSITIVO", () => {
  it.each([
    "disminuyó la", "disminuyeron los", "disminuye la", "incrementó el", "incrementaron el", "mantuvo la", "mantuvieron los",
    "mantiene la", "mantienen las", "ha bajado la", "han bajado los", "bajando la", "ha subido el", "han subido los", "subiendo el",
    "aumenta el", "aumentan los", "mejoró el", "mejoraron el", "mejora la", "mejoran las", "empeoró la", "empeora la", "empeoran los",
    "perdió la", "perdieron los", "pierde la", "pierden las", "cedió la", "cedieron los", "cae la", "caen los", "cayendo la",
    "creció el", "crecieron los", "crece el", "crecen los", "avanzó el", "ganó la", "repuntó el", "ascendió el", "escaló el", "saltó el",
    "descendió la", "desciende la", "retrocedió la", "retrocede la",
  ])("«la tasa %s ganancia total» dispara", (verboYDet) => {
    expect(coincidencias(`la tasa ${verboYDet} ganancia total`, PATRONES_CAUSA)).toContain("CAUSA.TRANSITIVO");
  });

  it.each([
    "La tasa de política monetaria (TPM) {TASA_TPM} disminuyó la ganancia total a {GANANCIA_TOTAL}.",
    "Los dividendos recibidos {DIVIDENDOS_RECIBIDOS} incrementaron el valor de las acciones a {VALOR_ACCIONES}.",
    "La tasa de política monetaria (TPM) {TASA_TPM} mantuvo la ganancia total en {GANANCIA_TOTAL}.",
    "La tasa de política monetaria (TPM) {TASA_TPM} ha bajado la ganancia total a {GANANCIA_TOTAL}.",
    "La tasa de política monetaria (TPM) {TASA_TPM} empeoró la ganancia total a {GANANCIA_TOTAL}.",
  ])("«%s» se rechaza en el DIARIO", (plantilla) => {
    expect(CAUSA_EN(validarSalida(salidaDe(PAQUETE, plantilla), PAQUETE))).toContain("CAUSA.TRANSITIVO");
  });
});

describe("H2: los adverbios y determinantes de la base no esquivan CAUSA.TRANSITIVO", () => {
  it.each([
    "bajó también la", "bajó además la", "bajó asimismo la", "bajó aún la", "bajó todavía la", "subieron también el",
    "bajó toda la", "subieron todo el", "bajó esa", "bajó ese", "bajó esos", "bajó esas", "subieron cada", "bajó otra", "bajó otro", "bajó otros",
    "bajó otras", "subieron todos los", "bajó unos", "bajó unas", "bajó todas las",
  ])("«la tasa %s ganancia total» dispara", (verboYDet) => {
    expect(coincidencias(`la tasa ${verboYDet} ganancia total`, PATRONES_CAUSA)).toContain("CAUSA.TRANSITIVO");
  });

  it("«La tasa bajó también la ganancia total a {H}.» se rechaza en el DIARIO", () => {
    const r = validarSalida(salidaDe(PAQUETE, "La tasa de política monetaria (TPM) {TASA_TPM} bajó también la ganancia total a {GANANCIA_TOTAL}."), PAQUETE);
    expect(CAUSA_EN(r)).toContain("CAUSA.TRANSITIVO");
  });
});

describe("H4: «subió un {H}» no es causativo: el determinante debe ir ante una palabra, no ante una cita", () => {
  const ENTRADA_VARIACION: EntradaPaquete<"DIARIO"> = {
    ...ENTRADA,
    hechos: [...ENTRADA.hechos, { ...de("H08", "VARIACION_DIA_VALOR", "-318.62", { direccion: "SUBE" }), fecha: AYER }],
  };
  const CON_VARIACION = construirPaquete(ENTRADA_VARIACION);

  it.each(["la variación del día del valor de las acciones subió un {H08}", "la variación bajó el {H08}", "el valor subió la {H08}"])(
    "«%s» no dispara CAUSA.TRANSITIVO", (texto) => {
      expect(coincidencias(texto, PATRONES_CAUSA)).not.toContain("CAUSA.TRANSITIVO");
    });

  it("en el DIARIO, «La variación del día del valor de las acciones subió un {H}.» no lleva CAUSA", () => {
    const r = validarSalida(salidaDe(CON_VARIACION, "La variación del día del valor de las acciones subió un {VARIACION_DIA_VALOR}."), CON_VARIACION);
    expect(CAUSA_EN(r).filter((p) => p.startsWith("CAUSA."))).toEqual([]);
  });
});

describe("H5: «escenario bajo» seguido de determinante no es causativo", () => {
  const ESCENARIOS = construirPaquete({
    tipo: "ESCENARIOS", hoy: "2027-03-17", versionesCalculo: { proyecciones: "proyecciones-ficticio-v5" }, avisos: [],
    hechos: [{ ...hecho("H01", "ESCENARIO_BAJO_CORTO", "33917.29", presentar("33917.29", entradaDeCatalogo("ESCENARIOS", "ESCENARIO_BAJO_CORTO")!.unidad), { calidad: "ESTIMADO" }), fecha: AYER }],
  } as EntradaPaquete<"ESCENARIOS">);

  it.each([
    "en el escenario bajo el valor quedaría en {H01}", "el escenario bajo la caída quedaría en {H01}", "En el escenario bajo los valores quedarían en {H01}",
    "en los escenarios bajo el valor", "en el Escenario bajo el valor",
  ])("«%s» no dispara CAUSA.TRANSITIVO", (texto) => {
    expect(coincidencias(texto, PATRONES_CAUSA)).not.toContain("CAUSA.TRANSITIVO");
  });

  it("en ESCENARIOS, «En el escenario bajo el valor quedaría en {H}.» no lleva CAUSA", () => {
    const r = validarSalida(salidaDe(ESCENARIOS, "En el escenario bajo el valor quedaría en {ESCENARIO_BAJO_CORTO}."), ESCENARIOS);
    expect(CAUSA_EN(r).filter((p) => p.startsWith("CAUSA."))).toEqual([]);
  });

  it("la exención es solo tras «escenario(s)»: «la tasa bajó el valor» y «el escenario subió el valor» siguen rechazados", () => {
    expect(coincidencias("la tasa bajó el valor", PATRONES_CAUSA)).toContain("CAUSA.TRANSITIVO");
    expect(coincidencias("el escenario subió el valor", PATRONES_CAUSA)).toContain("CAUSA.TRANSITIVO");
  });
});

describe("H6: CAUSA.TRANSITIVO queda atado a PATRONES_MARCA", () => {
  /** Los verbos de una palabra de las marcas de dirección (sube, baja, mantiene), sin los comparativos «superó» y «rebasó». */
  const COMPARATIVOS = /^(?:super|rebas)/u;
  const VERBOS_DE_UNA_PALABRA = PATRONES_MARCA
    .filter((p) => p.id === "DIRECCION.SUBE_VERBO" || p.id === "DIRECCION.BAJA_VERBO" || p.id === "DIRECCION.IGUAL")
    .flatMap((p) => p.alternativas)
    .filter((a) => /^\p{L}+$/u.test(a))
    .filter((a) => !COMPARATIVOS.test(a.normalize("NFD").replace(/[\u0300-\u036f]/gu, "")))
    .filter((a) => !/^(?:estables?|invariable)$/u.test(a));

  it("el filtro deja los verbos esperados y no está vacío", () => {
    expect(VERBOS_DE_UNA_PALABRA.length).toBeGreaterThan(40);
    expect(VERBOS_DE_UNA_PALABRA).toContain("mantuvo");
    expect(VERBOS_DE_UNA_PALABRA).not.toContain("superó");
    expect(VERBOS_DE_UNA_PALABRA).not.toContain("rebasaron");
  });

  it.each(VERBOS_DE_UNA_PALABRA)("el verbo de marca «%s» seguido de un determinante dispara CAUSA.TRANSITIVO", (verbo) => {
    expect(coincidencias(`la tasa ${verbo} la ganancia total`, PATRONES_CAUSA)).toContain("CAUSA.TRANSITIVO");
  });

  it("«superó» y «rebasó» quedan fuera a propósito: «superó el nivel de la regla» es una frase propia", () => {
    expect(coincidencias("el precio de cierre de la especie {H01} superó el nivel de la regla {H02}", PATRONES_CAUSA)).not.toContain("CAUSA.TRANSITIVO");
    expect(coincidencias("el precio rebasó el nivel de la regla", PATRONES_CAUSA)).not.toContain("CAUSA.TRANSITIVO");
  });
});

describe("vigilancia: «bajo el nivel de la regla» (preposición) y las frases propias", () => {
  it("«bajo» preposición ante un determinante SÍ dispara (el texto está plegado y «bajó» y «bajo» se igualan): se registra, no se exime", () => {
    // Si algún día se exime, esta prueba debe cambiar a propósito: hoy 008 no escribe «bajo el nivel de la regla».
    expect(coincidencias("el precio de cierre está bajo el nivel de la regla", PATRONES_CAUSA)).toContain("CAUSA.TRANSITIVO");
    // Lo mismo con «bajo lo aportado» fuera de «escenario bajo»: cae del lado seguro (rechaza), y la plantilla propia no lo escribe.
    expect(coincidencias("el valor quedaría, bajo lo aportado a largo plazo {H09}", PATRONES_CAUSA)).toContain("CAUSA.TRANSITIVO");
  });

  it.each([
    "el precio de cierre de la especie {H01} superó el nivel de la regla {H02}",
    "el escenario bajo a corto plazo quedaría en {H07}", "las especies subieron todas", "la ganancia total sube a la baja",
    "la tasa bajó; el valor es {H02}", "el valor subió, la ganancia total es {H03}",
  ])("«%s» no dispara CAUSA.TRANSITIVO", (texto) => {
    expect(coincidencias(texto, PATRONES_CAUSA)).not.toContain("CAUSA.TRANSITIVO");
  });
});
