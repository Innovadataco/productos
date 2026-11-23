// @vitest-environment jsdom
// La tarjeta de resumen (E5): pinta las frases, el aviso fijo, «Cifras usadas» (fuente, fecha y calidad), el pie y la
// marca DESACTUALIZADO; solo texto plano (lo que venga con etiquetas sale escapado). Y el candado de lenguaje: los
// textos de la tarjeta, fuera del aviso fijo del validador (que nombra la recomendación para negarla), no traen
// lenguaje de consejo; con control positivo. Datos inventados.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { elegirResumen } from "@/app/_comun/resumen-ia/elegir";
import { TarjetaResumenIa } from "@/app/_comun/resumen-ia/TarjetaResumenIa";
import { TEXTOS_RESUMEN_IA } from "@/app/_comun/resumen-ia/textos";
import type { VistaResumenIa } from "@/app/_comun/resumen-ia/tipos";
import { prohibidasEn } from "../operar/informe/lenguaje";
import { paqueteFicticio, publicadoFicticio } from "./apoyo.ficticio";

const pintar = (vista: VistaResumenIa): HTMLElement => {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(createElement(TarjetaResumenIa, { vista }));
  return raiz;
};
const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const conIa = (tipo: "DIARIO" | "REGLAS" | "ESCENARIOS", cambio?: string) => {
  const guardado = paqueteFicticio(tipo);
  return elegirResumen({ tipo, publicado: publicadoFicticio(guardado), hoy: { paquete: cambio === undefined ? guardado : paqueteFicticio(tipo, cambio), motivo: null } }).vista;
};

describe("TarjetaResumenIa", () => {
  it("con IA: título, frases, aviso, cifras usadas con fuente, fecha y calidad, el pie y la hora de redacción", () => {
    const vista = conIa("DIARIO");
    const raiz = pintar(vista);
    const tarjeta = raiz.querySelector("section.resumen-ia");
    expect(tarjeta?.getAttribute("aria-labelledby")).toBe("t-resumen-ia-diario");
    expect(texto(raiz.querySelector("#t-resumen-ia-diario"))).toBe(TEXTOS_RESUMEN_IA.titulos.DIARIO);
    expect([...raiz.querySelectorAll(".resumen-ia-frases li")].map(texto)).toEqual(vista.frases);
    expect(texto(raiz.querySelector(".resumen-ia-aviso"))).toBe(vista.aviso);
    const filas = [...raiz.querySelectorAll(".resumen-ia-cifras li")];
    expect(filas).toHaveLength(vista.cifras.length);
    expect(texto(filas[0])).toContain("fuente-ficticia");
    expect(texto(filas[0])).toContain(vista.cifras[0]!.fechaPresentada);
    expect(texto(filas[0])).toContain(TEXTOS_RESUMEN_IA.calidad.VERIFICADO);
    expect(texto(raiz.querySelector(".resumen-ia-pie"))).toContain(vista.pie);
    expect(raiz.querySelector(".resumen-ia-pie time")?.getAttribute("dateTime")).toBe("2027-03-17T18:41-05:00");
    expect(raiz.querySelector(".resumen-ia-desactualizado")).toBeNull();
    expect(texto(raiz.querySelector(".resumen-ia-vigencia"))).toBe(TEXTOS_RESUMEN_IA.vigencia.AL_DIA);
  });

  it("DESACTUALIZADO se marca a la vista", () => {
    const raiz = pintar(conIa("REGLAS", "AVISO_FICTICIO_NUEVO"));
    expect(texto(raiz.querySelector(".resumen-ia-desactualizado"))).toBe(TEXTOS_RESUMEN_IA.vigencia.DESACTUALIZADO);
    expect(TEXTOS_RESUMEN_IA.vigencia.DESACTUALIZADO).toMatch(/^DESACTUALIZADO/);
  });

  it("sin IA: el pie «Resumen sin IA», sin hora de redacción ni vigencia", () => {
    const paquete = paqueteFicticio("ESCENARIOS");
    const raiz = pintar(elegirResumen({ tipo: "ESCENARIOS", publicado: null, hoy: { paquete, motivo: null } }).vista);
    expect(texto(raiz.querySelector(".resumen-ia-pie"))).toBe("Resumen sin IA");
    expect(raiz.querySelector(".resumen-ia-pie time")).toBeNull();
    expect(raiz.querySelector(".resumen-ia-vigencia")).toBeNull();
  });

  it("no disponible: solo la nota, sin frases ni cifras", () => {
    const raiz = pintar(elegirResumen({ tipo: "REGLAS", publicado: null, hoy: { paquete: null, motivo: "OCUPADO" } }).vista);
    expect(texto(raiz.querySelector(".resumen-ia-nota"))).toBe(TEXTOS_RESUMEN_IA.notaMomento);
    expect(raiz.querySelector(".resumen-ia-frases")).toBeNull();
    expect(raiz.querySelector(".resumen-ia-cifras")).toBeNull();
  });

  it("solo texto plano: una frase con etiquetas sale escapada, sin HTML crudo", () => {
    const vista = { ...conIa("DIARIO"), frases: ["<img src=x onerror=alert(1)>"] };
    const raiz = pintar(vista);
    expect(raiz.querySelector("img")).toBeNull();
    expect(texto(raiz.querySelector(".resumen-ia-frases li"))).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("candado de lenguaje de la tarjeta", () => {
  const vistas = (): VistaResumenIa[] => [
    ...(["DIARIO", "REGLAS", "ESCENARIOS"] as const).flatMap((t) => [
      conIa(t), conIa(t, "AVISO_FICTICIO_NUEVO"),
      elegirResumen({ tipo: t, publicado: publicadoFicticio(paqueteFicticio(t)), hoy: { paquete: null, motivo: "OCUPADO" } }).vista,
      elegirResumen({ tipo: t, publicado: null, hoy: { paquete: paqueteFicticio(t), motivo: null } }).vista,
      elegirResumen({ tipo: t, publicado: null, hoy: { paquete: null, motivo: "SIN_PLAN_VIGENTE" } }).vista,
      elegirResumen({ tipo: t, publicado: null, hoy: { paquete: null, motivo: "OCUPADO" } }).vista,
    ]),
  ];
  /** El texto de la tarjeta sin el aviso fijo (ese lo pone el validador y niega la recomendación a propósito). */
  const sinAviso = (vista: VistaResumenIa): string => {
    const raiz = pintar(vista);
    raiz.querySelector(".resumen-ia-aviso")?.remove();
    return texto(raiz);
  };

  it("ninguna tarjeta trae lenguaje de consejo fuera del aviso fijo", () => {
    for (const v of vistas()) expect(prohibidasEn(sinAviso(v))).toEqual([]);
  });

  it("todos los textos fijos de la tarjeta pasan el detector", () => {
    const fijos = JSON.stringify(TEXTOS_RESUMEN_IA);
    expect(prohibidasEn(fijos)).toEqual([]);
  });

  it("control positivo: el detector muerde una frase de consejo plantada en la tarjeta", () => {
    const plantada = { ...conIa("DIARIO"), frases: ["Le recomendamos vender ya; es buen momento."] };
    expect(prohibidasEn(sinAviso(plantada))).toEqual(expect.arrayContaining(["le recomendamos", "buen momento"]));
  });

  it("el aviso es exactamente el que pone el validador (no se edita en la pantalla)", () => {
    const paquete = paqueteFicticio("ESCENARIOS");
    const v = elegirResumen({ tipo: "ESCENARIOS", publicado: null, hoy: { paquete, motivo: null } }).vista;
    expect(v.aviso).toMatch(/no es una recomendación|no recomienda/i);
  });
});
