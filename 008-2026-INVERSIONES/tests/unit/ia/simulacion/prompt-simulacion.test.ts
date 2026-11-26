/**
 * El prompt `resumen-simulacion-v1`: impersonal (en tercera persona, sin dirigirse al lector: el vocabulario de SIMULACION no
 * tiene «usted»), dice solo QUÉ describir («el estado actual de cada punto»), no menciona el cambio ni el antes y no nombra la
 * compra ni la venta. No se publicó con otro texto: es el v1 corregido antes de cualquier uso. Va con su hash en la historia, sin datos del paquete, sin
 * dígitos fuera del id de ejemplo, de usted y con `prohibidasEn` vacío. Los tres prompts de hoy no cambian (byte a byte).
 */
import { describe, expect, it } from "vitest";
import { ETIQUETA_RANGO } from "@/analisis/puntos/etiquetas";
import { TIPOS_RESUMEN } from "@/ia/contrato";
import { armarPedido, PATRON_VERSION_PROMPT } from "@/ia/generador";
import { sha256Hex } from "@/ia/hash";
import { construirPaquete } from "@/ia/paquete";
import { ESQUEMA_SALIDA_V3, esquemaSalidaDe } from "@/ia/prompts/esquema";
import { PROMPTS, VERSIONES_PROMPT, promptDe } from "@/ia/prompts/prompts";
import { coincidencias } from "@/ia/validador/patron";
import { PATRONES_TRATO } from "@/ia/validador/patrones-redaccion";
import { prohibidasEn } from "../../operar/informe/lenguaje";
import { entradaSimulacion } from "../apoyo/hechos.ficticio";

/** El hash del texto de cada versión de SIMULACION (nunca se edita una versión: se agrega otra). */
const HISTORIAL_SIMULACION: Readonly<Record<string, string>> = {
  "resumen-simulacion-v1": "5ce89d84dd259b7b34262359a07640c25328e1daeae4e2d69978fc90312fd3a1",
};

const prompt = PROMPTS.SIMULACION;

describe("prompt resumen-simulacion-v1", () => {
  it("es resumen-simulacion-v1, con su hash en la historia, congelado, y el Record de prompts es completo", () => {
    expect(VERSIONES_PROMPT.SIMULACION).toBe("resumen-simulacion-v1");
    expect(prompt.version).toBe("resumen-simulacion-v1");
    expect(prompt.version).toMatch(PATRON_VERSION_PROMPT);
    expect(prompt.hash).toBe(sha256Hex(prompt.texto));
    expect(HISTORIAL_SIMULACION[prompt.version]).toBe(prompt.hash);
    expect(Object.isFrozen(prompt)).toBe(true);
    expect(promptDe("SIMULACION")).toBe(prompt);
    expect(Object.keys(PROMPTS).sort()).toEqual([...TIPOS_RESUMEN].sort());
    expect(new Set(TIPOS_RESUMEN.map((t) => PROMPTS[t].texto)).size).toBe(TIPOS_RESUMEN.length);
  });

  it("dice solo QUÉ describir (el estado actual de cada punto) y no nombra la compra, la venta, la operación, la orden, la posición, el cambio ni el antes", () => {
    const texto = prompt.texto.toLowerCase();
    expect(texto).toContain("estado actual de cada punto");
    expect(texto).not.toMatch(/compr|vend|venta|operaci[oó]n|operar|\borden|posici[oó]n|simula|acci[oó]n|cambi|atribu|\bantes\b|c[oó]mo era/u);
    expect(prohibidasEn(prompt.texto)).toEqual([]);
  });

  it("es impersonal: en tercera persona, sin dirigirse al lector y sin «usted» ni «le»", () => {
    const texto = prompt.texto;
    expect(texto).toMatch(/en español de Colombia, en tercera persona, sin dirigirse al lector/u);
    expect(texto).not.toMatch(/\busted(?:es)?\b|\ble\b|\bles\b|de usted/iu);
    expect(coincidencias(texto, PATRONES_TRATO)).toEqual([]);
  });

  it("dice que no aconseje ni prediga, que cite solo con referencia y que no escriba cifras", () => {
    const texto = prompt.texto.toLowerCase();
    expect(texto).toMatch(/no d[eé] consejos/u);
    expect(texto).toMatch(/no prediga/u);
    expect(texto).toMatch(/no escriba cifras/u);
    expect(texto).toMatch(/referencia/u);
  });

  it("explica la especie y trae el ejemplo con la referencia del nombre (el código pone el nombre, nunca el modelo)", () => {
    const texto = prompt.texto;
    expect(texto).toMatch(/campo especie/u);
    expect(texto).toContain('{"texto":"El peso de la especie"},{"ref":"H01"},{"texto":"queda en"},{"ref":"H01"}');
  });

  it("pide la salida salida-v3: frases y revisar, hasta cuatro frases y hasta dos ítems nominales, ALTA primero", () => {
    const texto = prompt.texto;
    expect(texto).toContain('"revisar"');
    expect(texto).toMatch(/hasta cuatro frases/u);
    expect(texto).toMatch(/hasta dos ítems/u);
    expect(texto).toMatch(/sin verbos/u);
    expect(texto).toMatch(/ALTA/u);
    expect(esquemaSalidaDe("SIMULACION")).toBe(ESQUEMA_SALIDA_V3);
  });

  it("trae las palabras de cada rango (las de ETIQUETA_RANGO) para que el modelo use la de su rango", () => {
    const texto = prompt.texto.toLowerCase();
    for (const porRango of Object.values(ETIQUETA_RANGO)) for (const palabra of Object.values(porRango)) expect(texto, palabra as string).toContain((palabra as string).toLowerCase());
  });

  it("sin dígitos fuera del id de ejemplo «H01»", () => {
    expect(prompt.texto).toContain('{"ref":"H01"}');
    expect(prompt.texto.replace(/H01/g, "")).not.toMatch(/\p{N}/u);
  });

  it("armarPedido lo acepta con la vista ciega de un paquete de SIMULACION y el esquema v3, sin datos del paquete", () => {
    const paquete = construirPaquete(entradaSimulacion());
    const pedido = armarPedido({ paquete, prompt, esquemaSalida: ESQUEMA_SALIDA_V3, limiteMs: 60_000 });
    expect(pedido.prompt.hash).toBe(prompt.hash);
    expect(JSON.stringify(pedido.vista)).not.toMatch(/FICTICIA|42,5|rango": "TOCADA/u);
  });

  it("los tres prompts de hoy no cambian", () => {
    expect(VERSIONES_PROMPT).toMatchObject({ DIARIO: "resumen-diario-v4", REGLAS: "resumen-reglas-v3", ESCENARIOS: "resumen-escenarios-v3" });
  });
});
