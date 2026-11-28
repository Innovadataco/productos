/**
 * Frente 1c de CAUSA: «a falta de X, …» es un contrafactual de la misma clase que «sin X». Hoy publica en DIARIO y REGLAS
 * («A falta de la ganancia por ventas, la ganancia total bajó a …»). Tiene que rechazar con CAUSA.CONECTOR, al inicio y en
 * medio de la frase. «faltan», «falta» y «faltantes» sueltos (las etiquetas del catálogo) no son causa. Datos inventados.
 */
import { describe, expect, it } from "vitest";
import { coincidencias } from "@/ia/validador/patron";
import { PATRONES_CAUSA } from "@/ia/validador/patrones-causa";
import { validarSalida } from "@/ia/validador/validar";
import { paqueteFicticio, salidaDe } from "./apoyo/salidas.ficticio";

const FIJA = {
  DIARIO: "El valor de las acciones subió a {VALOR_ACCIONES}.",
  REGLAS: "{ESPECIE_NOMBRE}: la distancia al nivel de la regla es {REGLA_DISTANCIA} y está cerca.",
} as const;

const FRASES = [
  { tipo: "DIARIO", lugar: "al inicio", frase: "A falta de la ganancia por ventas, la ganancia total bajó a {GANANCIA_TOTAL}." },
  { tipo: "DIARIO", lugar: "en medio", frase: "La ganancia total, a falta de la ganancia por ventas, bajó a {GANANCIA_TOTAL}." },
  { tipo: "DIARIO", lugar: "«a falta del»", frase: "A falta del valor de las acciones, la ganancia total bajó a {GANANCIA_TOTAL}." },
  { tipo: "REGLAS", lugar: "al inicio", frase: "A falta del plazo de la regla, faltan {REGLA_DIAS_AL_PLAZO} para el plazo de la regla." },
  { tipo: "REGLAS", lugar: "en medio", frase: "Faltan {REGLA_DIAS_AL_PLAZO}, a falta de la regla, para el plazo de la regla." },
  { tipo: "REGLAS", lugar: "«a falta del»", frase: "A falta del cierre, faltan {REGLA_DIAS_AL_PLAZO} para el plazo de la regla." },
] as const;

describe("«a falta de(l)» es una causa", () => {
  it.each(FRASES)("$tipo · $lugar", ({ tipo, frase }) => {
    const paquete = paqueteFicticio(tipo);
    const r = validarSalida(salidaDe(paquete, FIJA[tipo], frase), paquete);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivos).toContain("CAUSA");
    expect(r.hallazgos.map((h) => h.patron)).toContain("CAUSA.CONECTOR");
  });

  it.each(["a falta de la ganancia por ventas", "a falta del cierre", "A falta de ventas"])("«%s» da CAUSA.CONECTOR", (texto) => {
    expect(coincidencias(texto, PATRONES_CAUSA)).toContain("CAUSA.CONECTOR");
  });
});

describe("vigilancia: «falta», «faltan» y «faltantes» sueltos no son causa", () => {
  it.each([
    "faltan {REGLA_DIAS_AL_PLAZO} para el plazo de la regla", "especies que faltan", "el dato que falta", "hay datos faltantes",
    "falta el cierre", "a faltas",
  ])("«%s» no dispara CAUSA", (texto) => {
    expect(coincidencias(texto, PATRONES_CAUSA)).toEqual([]);
  });
});
