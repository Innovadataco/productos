/**
 * Candado de las listas: la huella (sha256) de cada lista de patrones (id, forma, mirada atrás y alternativas, en orden)
 * y del vocabulario cerrado (la lista base y el condicional) queda fija aquí. Quitar o agregar una sola palabra de una
 * lista pone esta prueba en rojo (la prueba de mutación por alternativa solo ve las que siguen en `src/`). Cambiar una
 * lista es otra versión del validador: se sube `VERSION_VALIDADOR` y se escribe aquí la huella nueva.
 * EXCEPCIÓN ESCRITA (ver `codigos.ts`): las listas de CAUSA y el vocabulario de v3 se cambiaron sin subir la versión,
 * porque v3 no salió a producción; por eso `HUELLAS_V3` se reescribió (no hay una huella v3 anterior que conservar).
 */
import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/ia/hash";
import { VERSION_VALIDADOR } from "@/ia/validador/codigos";
import type { Patron } from "@/ia/validador/patron";
import { PATRONES_CAUSA } from "@/ia/validador/patrones-causa";
import { PATRONES_CIFRA_EN_PALABRAS, PATRONES_IDIOMA, PATRONES_MARCA, PATRONES_SIN_DATO } from "@/ia/validador/patrones-lengua";
import { PATRONES_PREDICCION, PATRONES_RECOMENDACION, PATRONES_TRATO } from "@/ia/validador/patrones-redaccion";
import { CONDICIONALES, PALABRAS_BASE } from "@/ia/validador/vocabulario";

/** Las huellas de la versión vigente del validador. */
const HUELLAS_V1: Readonly<Record<string, string>> = {
  RECOMENDACION: "8117a2dd839c94f79ed3878b0de971b75e5b4f6f3c2d1ff97c9b96d1e690cfec",
  PREDICCION: "cab62560bbe9cb1ea05e7975e516f9b4748e4bc7117e286264fc489e921ca416",
  TRATO: "7bef84c177a32fad5a3c4036474868cc9f764a15f6e8c226b5f203fe93f92709",
  CIFRA_EN_PALABRAS: "26f2383b38c21986bd04a040a812f8fcfd54556cbae5fac46a03013bc1e79f1a",
  IDIOMA: "de090ea3b88aeee081eeaaf22e5f7d9d377fd3575198785e766b3b47d5a8c021",
  MARCA: "f9b1712e4e272918675185cb6343482eb194adf54d58163211f795dd3d7272aa",
  SIN_DATO: "37afc2a06de4fa8b22bfb1a432548878569d7aa6847311d284c7c18315a82735",
  VOCABULARIO: "465c96414006feec69381c0f09c0dc90685e91aef6efe45fa9464cb69668f466",
};

/** La versión tercera: el vocabulario pierde las ocho palabras de causa y suma la lista CAUSA (excepción escrita: ver `codigos.ts`). */
const HUELLAS_V3: Readonly<Record<string, string>> = {
  ...HUELLAS_V1,
  VOCABULARIO: "46ccb03c843cce641f6cbfd7a00b791dd9e75622ce7d1265c16fa36fe03bd132",
  CAUSA: "b96a49cf72e4e58a7caeeb9ceeda2e9b860d9847b7c034a5a58bf70eb0ba8982",
};

/** v2 cambia solo la lectura de la salida (segmentos): las listas son las de v1. v3 compone los obligatorios del DIARIO y estrena CAUSA. */
const HUELLAS: Readonly<Record<string, Readonly<Record<string, string>>>> = { "validador-v1": HUELLAS_V1, "validador-v2": HUELLAS_V1, "validador-v3": HUELLAS_V3 };

const huella = (patrones: readonly Patron[]): string => sha256Hex(JSON.stringify(patrones.map((p) => [p.id, p.sobre, p.antes, p.alternativas])));

const ACTUALES: Readonly<Record<string, string>> = {
  RECOMENDACION: huella(PATRONES_RECOMENDACION),
  PREDICCION: huella(PATRONES_PREDICCION),
  TRATO: huella(PATRONES_TRATO),
  CIFRA_EN_PALABRAS: huella(PATRONES_CIFRA_EN_PALABRAS),
  IDIOMA: huella(PATRONES_IDIOMA),
  MARCA: huella(PATRONES_MARCA),
  SIN_DATO: huella(PATRONES_SIN_DATO),
  VOCABULARIO: sha256Hex(JSON.stringify([PALABRAS_BASE, CONDICIONALES])),
  CAUSA: huella(PATRONES_CAUSA),
};

describe("candado de las listas del validador", () => {
  it("la versión vigente tiene sus huellas", () => {
    expect(Object.keys(HUELLAS)).toContain(VERSION_VALIDADOR);
  });

  it.each(Object.keys(ACTUALES))("%s: la huella coincide con la de la versión vigente", (lista) => {
    expect(ACTUALES[lista]).toBe(HUELLAS[VERSION_VALIDADOR]?.[lista]);
  });

  it("control positivo: quitar una alternativa cambia la huella", () => {
    const [primero, ...resto] = PATRONES_MARCA as readonly Patron[];
    const sinUna = [{ ...(primero as Patron), alternativas: (primero as Patron).alternativas.slice(1) }, ...resto];
    expect(huella(sinUna)).not.toBe(ACTUALES.MARCA);
  });
});
