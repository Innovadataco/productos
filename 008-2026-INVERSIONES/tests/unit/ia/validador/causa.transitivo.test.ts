/**
 * Frente 3a de CAUSA: el causativo transitivo («la tasa bajó la ganancia total», «los dividendos subieron el valor de las
 * acciones») atribuye un hecho a otro con un verbo de marca seguido de un determinante. Hoy publica en el DIARIO.
 * Y la familia nominal de «falta»: «la falta de dividendos…» es el mismo contrafactual que «a falta de». Datos inventados.
 */
import { describe, expect, it } from "vitest";
import { entradaDeCatalogo, type ClaveHecho } from "@/ia/catalogo";
import type { EntradaPaquete } from "@/ia/contrato";
import { construirPaquete } from "@/ia/paquete";
import { presentar } from "@/ia/presentar";
import { coincidencias } from "@/ia/validador/patron";
import { PATRONES_CAUSA } from "@/ia/validador/patrones-causa";
import { validarSalida } from "@/ia/validador/validar";
import { hecho } from "../apoyo/hechos.ficticio";
import { salidaDe } from "./apoyo/salidas.ficticio";

const AYER = "2027-03-16";
const de = (id: string, clave: ClaveHecho, valor: string, extra: Record<string, unknown> = {}) =>
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
    "a la baja", "la tasa bajó y el valor subió", "el valor de la especie bajó {H02}", "subieron {H01} y {H02}",
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
