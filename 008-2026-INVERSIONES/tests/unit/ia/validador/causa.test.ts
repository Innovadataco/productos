/**
 * CAUSA: el validador no publica un texto que atribuya una causa («subió por la tasa», «ante el mercado», «desde el
 * cierre», «debido a…»). Evidencia: los casos que hoy PUBLICAN en los tres tipos (DIARIO, REGLAS, ESCENARIOS) y en los
 * moldes del DIARIO v5, con la causa al final y al inicio de la frase. Valores y especies inventados (FICTICIA-*, 2027).
 */
import { describe, expect, it } from "vitest";
import { CLAVES_DE_ESPECIE_DIARIO, moldeDiario } from "@/ia/prompts/moldes-diario";
import type { PaqueteHechos, TipoResumen } from "@/ia/contrato";
import { validarSalida } from "@/ia/validador/validar";
import { paqueteDiarioEspecie } from "./apoyo/diario-especie.ficticio";
import { FRASES_VALIDAS, paqueteFicticio, salidaDe } from "./apoyo/salidas.ficticio";

type Tipo = TipoResumen;

/** La frase objetivo de cada tipo (sin punto), a la que se le agrega la causa. */
const OBJETIVO: Readonly<Record<Tipo, string>> = {
  DIARIO: "El valor de la especie {ESPECIE_NOMBRE} es {VALOR_ESPECIE}",
  REGLAS: "Faltan {REGLA_DIAS_AL_PLAZO} para el plazo de la regla",
  ESCENARIOS: "En el escenario central a corto plazo, el valor quedaría en {ESCENARIO_CENTRAL_CORTO}",
};

/** La frase fija de cada tipo: cita el hecho obligatorio, para que la frase objetivo sea la única que cambia. */
const FIJA: Readonly<Record<Tipo, string>> = {
  DIARIO: "El valor de las acciones subió a {VALOR_ACCIONES}.",
  REGLAS: "{ESPECIE_NOMBRE}: la distancia al nivel de la regla es {REGLA_DISTANCIA} y está cerca.",
  ESCENARIOS: "La probabilidad de terminar por debajo de lo aportado es {PROBABILIDAD_BAJO_APORTADO}.",
};

/** Las causas que HOY publican (validador sin CAUSA), por tipo. */
const CAUSAS: Readonly<Record<Tipo, readonly string[]>> = {
  DIARIO: [
    "por el mercado", "por la tasa", "ante la tasa", "según la tasa", "tras la tasa", "ante el mercado", "según el mercado", "con la tasa",
    "con el mercado", "frente a la tasa", "desde el cierre", "tras el cierre", "por el precio", "por el cierre", "por el dividendo",
    "por la política monetaria", "por el IPC", "por la TRM", "por el indicador", "por la comisión", "como el mercado", "por los precios", "por las tasas",
  ],
  REGLAS: [
    "por el precio", "por el cierre", "ante el cierre", "según el cierre", "tras el cierre", "por el dividendo", "por el pago del dividendo",
    "por la regla", "por el plan", "según el plan", "ante el precio", "con el cierre", "desde el cierre", "tras el pago", "por el nivel",
  ],
  ESCENARIOS: [
    "por la volatilidad", "por el riesgo", "por la historia", "según la historia", "ante la volatilidad", "con la volatilidad", "desde el inicio",
    "según la proyección", "por el rendimiento", "por la volatilidad anual",
  ],
};

/** El patrón que debe nombrar el hallazgo, por la primera palabra de la causa. */
function patronEsperado(causa: string): string {
  const primera = (causa.split(" ")[0] ?? "").toLowerCase();
  if (primera === "por") return "CAUSA.POR";
  if (primera === "desde") return "CAUSA.DESDE";
  if (primera === "con") return "CAUSA.CON";
  return "CAUSA.CONECTOR";
}

const mayuscula = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const minuscula = (s: string): string => (s.startsWith("{") ? s : s.charAt(0).toLowerCase() + s.slice(1));

interface Resultado {
  readonly ok: boolean;
  readonly motivos: readonly string[];
  readonly patrones: readonly string[];
}

function correr(paquete: PaqueteHechos, ...plantillas: readonly string[]): Resultado {
  const r = validarSalida(salidaDe(paquete, ...plantillas), paquete);
  return r.ok ? { ok: true, motivos: [], patrones: [] } : { ok: false, motivos: r.motivos, patrones: r.hallazgos.map((h) => h.patron) };
}

const CASOS = (["DIARIO", "REGLAS", "ESCENARIOS"] as const).flatMap((tipo) => CAUSAS[tipo].flatMap((causa) => [
  { tipo, posicion: "al final", causa, frase: `${OBJETIVO[tipo]} ${causa}.` },
  { tipo, posicion: "al inicio", causa, frase: `${mayuscula(causa)}, ${minuscula(OBJETIVO[tipo])}.` },
]));

describe("controles positivos: sin causa, las frases publican", () => {
  it.each(["DIARIO", "REGLAS", "ESCENARIOS"] as const)("%s: la frase objetivo sola publica", (tipo) => {
    expect(correr(paqueteFicticio(tipo), FIJA[tipo], `${OBJETIVO[tipo]}.`).ok).toBe(true);
  });

  it.each(["DIARIO", "REGLAS", "ESCENARIOS"] as const)("%s: las frases válidas publican", (tipo) => {
    expect(correr(paqueteFicticio(tipo), ...FRASES_VALIDAS[tipo]).ok).toBe(true);
  });
});

describe("el validador rechaza la causa con CAUSA", () => {
  it.each(CASOS)("$tipo · $posicion · «$causa»", ({ tipo, causa, frase }) => {
    const r = correr(paqueteFicticio(tipo), FIJA[tipo], frase);
    expect(r.ok).toBe(false);
    expect(r.motivos).toContain("CAUSA");
    expect(r.patrones).toContain(patronEsperado(causa));
  });
});

describe("la frase vieja de controles y la de las ventas", () => {
  const p = paqueteFicticio("DIARIO");

  it("«subió por la ganancia total» da CAUSA.POR", () => {
    const r = correr(p, "El valor de las acciones {VALOR_ACCIONES} subió por la ganancia total {GANANCIA_TOTAL}.");
    expect(r.ok).toBe(false);
    expect(r.motivos).toContain("CAUSA");
    expect(r.patrones).toContain("CAUSA.POR");
  });

  it("«subió a {VALOR_ACCIONES} por ventas» da CAUSA.POR", () => {
    const r = correr(p, "El valor de las acciones subió a {VALOR_ACCIONES} por ventas.");
    expect(r.ok).toBe(false);
    expect(r.motivos).toContain("CAUSA");
    expect(r.patrones).toContain("CAUSA.POR");
  });

  it("la frase reescrita sin «por» publica", () => {
    expect(correr(p, "El valor de las acciones {VALOR_ACCIONES} subió, la ganancia total es {GANANCIA_TOTAL}.").ok).toBe(true);
  });
});

describe("los moldes del DIARIO v5 con una causa se rechazan", () => {
  /** Las causas que publicaban sobre los moldes v5. */
  const CAUSAS_V5 = [
    "por el mercado", "por la tasa", "ante la tasa", "según la tasa", "tras el cierre", "con la tasa", "desde el cierre", "frente al mercado",
    "por la política monetaria", "por la TRM", "por el dividendo",
  ];
  const paquete = paqueteDiarioEspecie();
  const idDe = (clave: string): string | undefined => paquete.hechos.find((h) => h.clave === clave)?.id;
  const claves = CLAVES_DE_ESPECIE_DIARIO.filter((c) => idDe(c) !== undefined && idDe("ESPECIE_NOMBRE") !== undefined);
  const conCitas = (molde: string, clave: string): string =>
    molde.replace(/\[nombre\]/gu, `{${idDe("ESPECIE_NOMBRE")}}`).replace(/\[dato\]/gu, `{${idDe(clave)}}`);

  it("hay moldes con datos en el paquete", () => {
    expect(claves.length).toBeGreaterThanOrEqual(3);
  });

  it.each(CLAVES_DE_ESPECIE_DIARIO.slice(0, 3))("%s: el molde solo publica", (clave) => {
    expect(correr(paquete, conCitas(moldeDiario(clave), clave)).ok).toBe(true);
  });

  const CASOS_V5 = CLAVES_DE_ESPECIE_DIARIO.slice(0, 3).flatMap((clave) => CAUSAS_V5.flatMap((causa) => {
    const base = moldeDiario(clave).replace(/\.$/u, "");
    return [
      { clave, posicion: "al final", causa, frase: `${base} ${causa}.` },
      { clave, posicion: "al inicio", causa, frase: `${mayuscula(causa)}, ${minuscula(base)}.` },
    ];
  }));

  it.each(CASOS_V5)("$clave · $posicion · «$causa»", ({ clave, causa, frase }) => {
    const r = correr(paquete, conCitas(frase, clave));
    expect(r.ok).toBe(false);
    expect(r.motivos).toContain("CAUSA");
    expect(r.patrones).toContain(patronEsperado(causa));
  });
});
