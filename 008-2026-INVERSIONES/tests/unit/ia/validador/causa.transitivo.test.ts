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

/** Los dos patrones del causativo: CAUSA.TRANSITIVO (texto plegado) y CAUSA.TRANSITIVO_BAJO («bajó» con tilde, sobre minúsculas). */
const ES_TRANSITIVO = (id: string): boolean => id === "CAUSA.TRANSITIVO" || id === "CAUSA.TRANSITIVO_BAJO";
const transitivos = (texto: string): readonly string[] => coincidencias(texto, PATRONES_CAUSA).filter(ES_TRANSITIVO);
const transitivosEn = (r: ReturnType<typeof validarSalida>): readonly string[] => (r.ok ? [] : r.hallazgos.map((h) => h.patron).filter(ES_TRANSITIVO));
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
    expect(transitivosEn(r)).not.toEqual([]);
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
    expect(transitivos(texto)).not.toEqual([]);
  });

  it.each(VERBOS)("el verbo «%s» seguido de un determinante dispara", (verbo) => {
    expect(transitivos(`la tasa ${verbo} la ganancia total`)).not.toEqual([]);
  });

  it.each(DETERMINANTES)("el determinante «%s» tras el verbo dispara", (det) => {
    expect(transitivos(`la tasa bajó ${det} valor`)).not.toEqual([]);
  });

  it("sin tildes y en mayúsculas también", () => {
    expect(transitivos("La tasa BAJO LA ganancia total")).not.toEqual([]);
  });
});

describe("vigilancia: lo intransitivo y lo propio no es causa transitiva", () => {
  it.each([
    "El valor de las acciones subió a {H03} y la ganancia total bajó a {H04}.", "la ganancia total bajó a {H04}", "el valor subió",
    "a la baja", "la tasa bajó y el valor subió", "el valor de la especie bajó {H02}", "subieron {H01} y {H02}", "el valor subió, la ganancia total es {H03}", "la tasa bajó; el valor es {H02}", "la tasa bajó (la ganancia total es {H03})",
  ])("«%s» no dispara CAUSA.TRANSITIVO", (texto) => {
    expect(transitivos(texto)).toEqual([]);
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
    expect(transitivos(`la tasa ${verboYDet} ganancia total`)).not.toEqual([]);
  });

  it.each([
    "La tasa de política monetaria (TPM) {TASA_TPM} disminuyó la ganancia total a {GANANCIA_TOTAL}.",
    "Los dividendos recibidos {DIVIDENDOS_RECIBIDOS} incrementaron el valor de las acciones a {VALOR_ACCIONES}.",
    "La tasa de política monetaria (TPM) {TASA_TPM} mantuvo la ganancia total en {GANANCIA_TOTAL}.",
    "La tasa de política monetaria (TPM) {TASA_TPM} ha bajado la ganancia total a {GANANCIA_TOTAL}.",
    "La tasa de política monetaria (TPM) {TASA_TPM} empeoró la ganancia total a {GANANCIA_TOTAL}.",
  ])("«%s» se rechaza en el DIARIO", (plantilla) => {
    expect(transitivosEn(validarSalida(salidaDe(PAQUETE, plantilla), PAQUETE))).not.toEqual([]);
  });
});

describe("H2: los adverbios y determinantes de la base no esquivan CAUSA.TRANSITIVO", () => {
  it.each([
    "bajó también la", "bajó además la", "bajó asimismo la", "bajó aún la", "bajó todavía la", "subieron también el",
    "bajó toda la", "subieron todo el", "bajó esa", "bajó ese", "bajó esos", "bajó esas", "subieron cada", "bajó otra", "bajó otro", "bajó otros",
    "bajó otras", "subieron todos los", "bajó unos", "bajó unas", "bajó todas las",
  ])("«la tasa %s ganancia total» dispara", (verboYDet) => {
    expect(transitivos(`la tasa ${verboYDet} ganancia total`)).not.toEqual([]);
  });

  it("«La tasa bajó también la ganancia total a {H}.» se rechaza en el DIARIO", () => {
    const r = validarSalida(salidaDe(PAQUETE, "La tasa de política monetaria (TPM) {TASA_TPM} bajó también la ganancia total a {GANANCIA_TOTAL}."), PAQUETE);
    expect(transitivosEn(r)).not.toEqual([]);
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
      expect(transitivos(texto)).toEqual([]);
    });

  it("en el DIARIO, «La variación del día del valor de las acciones subió un {H}.» no lleva CAUSA", () => {
    const r = validarSalida(salidaDe(CON_VARIACION, "La variación del día del valor de las acciones subió un {VARIACION_DIA_VALOR}."), CON_VARIACION);
    expect(CAUSA_EN(r).filter((p) => p.startsWith("CAUSA."))).toEqual([]);
  });
});

/**
 * Un paquete de ESCENARIOS como el del armador real (`src/ia/hechos/escenarios.ts`): los escenarios de cada horizonte y el
 * rendimiento histórico llevan dirección (SUBE o BAJA frente al valor inicial); la volatilidad, la probabilidad y la caída no.
 */
const ESCENARIOS_CON_DIRECCION = construirPaquete({
  tipo: "ESCENARIOS", hoy: "2027-03-17", versionesCalculo: { proyecciones: "proyecciones-ficticio-v5" }, avisos: [],
  hechos: ([
    ["H01", "ESCENARIO_CENTRAL_CORTO", "41377.19", { calidad: "ESTIMADO", obligatorio: true, direccion: "SUBE" }],
    ["H02", "ESCENARIO_CENTRAL_LARGO", "47377.19", { calidad: "ESTIMADO", obligatorio: true, direccion: "SUBE" }],
    ["H03", "PROBABILIDAD_BAJO_APORTADO", "17.3", { calidad: "ESTIMADO", obligatorio: true }],
    ["H04", "CAIDA_MAXIMA_MEDIANA", "-21.3", { calidad: "ESTIMADO" }],
    ["H05", "VOLATILIDAD_ANUAL", "23.7", { calidad: "ESTIMADO" }],
    ["H06", "ESCENARIO_BAJO_CORTO", "33377.19", { calidad: "ESTIMADO", direccion: "BAJA" }],
    ["H07", "ESCENARIO_ALTO_CORTO", "49377.19", { calidad: "ESTIMADO", direccion: "SUBE" }],
    ["H08", "ESCENARIO_BAJO_LARGO", "31377.19", { calidad: "ESTIMADO", direccion: "BAJA" }],
    ["H09", "RENDIMIENTO_ANUAL_HISTORICO", "5.3", { calidad: "CALCULADO", direccion: "SUBE" }],
  ] as const).map(([id, clave, valor, extra]) => ({
    ...hecho(id, clave, valor, presentar(valor, entradaDeCatalogo("ESCENARIOS", clave)!.unidad), extra), fecha: AYER,
  })),
} as EntradaPaquete<"ESCENARIOS">);

describe("H5: «escenario bajo» seguido de determinante no es causativo", () => {
  it.each([
    "en el escenario bajo el valor quedaría en {H01}", "el escenario bajo la caída quedaría en {H01}", "En el escenario bajo los valores quedarían en {H01}",
    "en los escenarios bajo el valor", "en el Escenario bajo el valor",
  ])("«%s» no dispara el causativo", (texto) => {
    expect(transitivos(texto)).toEqual([]);
  });

  it("en ESCENARIOS con dirección, «En el escenario bajo el valor quedaría en {H}.» no lleva CAUSA", () => {
    const r = validarSalida(salidaDe(ESCENARIOS_CON_DIRECCION, "En el escenario bajo el valor quedaría en {ESCENARIO_BAJO_CORTO}."), ESCENARIOS_CON_DIRECCION);
    expect(CAUSA_EN(r).filter((p) => p.startsWith("CAUSA."))).toEqual([]);
  });

  it("la exención es solo «bajo» sin tilde tras «escenario(s)»: lo demás sigue rechazado", () => {
    expect(transitivos("la tasa bajó el valor")).not.toEqual([]);
    expect(transitivos("el escenario central bajó el valor")).not.toEqual([]);
  });
});

describe("H7 y H8: «escenario» pegado al verbo no exime; los causativos de ESCENARIOS rechazan de punta a punta", () => {
  const SEIS = [
    "El rendimiento anual histórico {RENDIMIENTO_ANUAL_HISTORICO} del escenario subió el escenario alto a corto plazo a {ESCENARIO_ALTO_CORTO}.",
    "El rendimiento anual histórico {RENDIMIENTO_ANUAL_HISTORICO} del escenario aumentó el escenario central a largo plazo a {ESCENARIO_CENTRAL_LARGO}.",
    "La volatilidad anual histórica {VOLATILIDAD_ANUAL} del escenario bajó el escenario bajo a corto plazo a {ESCENARIO_BAJO_CORTO}.",
    "La volatilidad anual histórica {VOLATILIDAD_ANUAL} del escenario bajó la probabilidad {PROBABILIDAD_BAJO_APORTADO}.",
    "La volatilidad anual histórica {VOLATILIDAD_ANUAL} del escenario bajó la caída máxima mediana {CAIDA_MAXIMA_MEDIANA}.",
    "La caída máxima mediana {CAIDA_MAXIMA_MEDIANA} de los escenarios bajaron el escenario bajo a largo plazo a {ESCENARIO_BAJO_LARGO}.",
  ] as const;

  it.each(SEIS)("«%s» se rechaza con el causativo", (plantilla) => {
    const r = validarSalida(salidaDe(ESCENARIOS_CON_DIRECCION, plantilla), ESCENARIOS_CON_DIRECCION);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivos).toContain("CAUSA");
    expect(transitivosEn(r)).not.toEqual([]);
  });

  it("«el escenario subió el valor» rechaza con CAUSA (ya no hay exención ante el verbo)", () => {
    expect(transitivos("el escenario subió el valor")).not.toEqual([]);
    const r = validarSalida(salidaDe(ESCENARIOS_CON_DIRECCION, "El escenario subió el valor quedaría en {ESCENARIO_ALTO_CORTO}."), ESCENARIOS_CON_DIRECCION);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivos).toContain("CAUSA");
    expect(transitivosEn(r)).not.toEqual([]);
  });

  it.each(["el escenario bajó el valor", "los escenarios bajaron el valor", "el escenario subió la caída", "el escenario aumentó el valor"])(
    "«%s» dispara el causativo", (texto) => {
      expect(transitivos(texto)).not.toEqual([]);
    });

  it("H9, residual documentado (BAJO): «del escenario bajo el escenario bajo» con «bajo» sin tilde como verbo no dispara", () => {
    // Sin tilde, «bajo» tras «escenario» es indistinguible del adjetivo de H5; el modelo debe escribir el verbo con tilde.
    expect(transitivos("la volatilidad anual histórica {H05} del escenario bajo el escenario bajo a corto plazo a {H06}")).toEqual([]);
  });
});

describe("«ha subido», «han subido», «ha bajado» y «han bajado» con determinante dan CAUSA.TRANSITIVO", () => {
  it.each(["ha subido el valor", "han subido los valores", "ha bajado la ganancia total", "han bajado las tasas"])("«la tasa %s» dispara", (resto) => {
    expect(coincidencias(`la tasa ${resto}`, PATRONES_CAUSA)).toContain("CAUSA.TRANSITIVO");
  });
});

describe("H6: CAUSA.TRANSITIVO y CAUSA.TRANSITIVO_BAJO quedan atados a PATRONES_MARCA", () => {
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

  it.each(VERBOS_DE_UNA_PALABRA)("el verbo de marca «%s» seguido de un determinante dispara el causativo", (verbo) => {
    expect(transitivos(`la tasa ${verbo} la ganancia total`)).not.toEqual([]);
  });

  it("«superó» y «rebasó» quedan fuera a propósito: «superó el nivel de la regla» es una frase propia", () => {
    expect(transitivos("el precio de cierre de la especie {H01} superó el nivel de la regla {H02}")).toEqual([]);
    expect(transitivos("el precio rebasó el nivel de la regla")).toEqual([]);
  });
});

describe("vigilancia: «bajo el nivel de la regla» (preposición) y las frases propias", () => {
  it("«bajo» preposición ante un determinante SÍ dispara (el texto está plegado y «bajó» y «bajo» se igualan): se registra, no se exime", () => {
    // Si algún día se exime, esta prueba debe cambiar a propósito: hoy 008 no escribe «bajo el nivel de la regla».
    expect(transitivos("el precio de cierre está bajo el nivel de la regla")).not.toEqual([]);
    // Lo mismo con «bajo lo aportado» fuera de «escenario bajo»: cae del lado seguro (rechaza), y la plantilla propia no lo escribe.
    expect(transitivos("el valor quedaría, bajo lo aportado a largo plazo {H09}")).not.toEqual([]);
  });

  it.each([
    "el precio de cierre de la especie {H01} superó el nivel de la regla {H02}",
    "el escenario bajo a corto plazo quedaría en {H07}", "las especies subieron todas", "la ganancia total sube a la baja",
    "la tasa bajó; el valor es {H02}", "el valor subió, la ganancia total es {H03}",
  ])("«%s» no dispara CAUSA.TRANSITIVO", (texto) => {
    expect(transitivos(texto)).toEqual([]);
  });
});
