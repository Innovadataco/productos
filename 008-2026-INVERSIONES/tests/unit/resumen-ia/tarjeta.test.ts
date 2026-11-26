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
import { AVISOS } from "@/ia/validador/resumen";
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
    expect(TEXTOS_RESUMEN_IA.vigencia.DESACTUALIZADO).toContain("los datos cambiaron desde este análisis");
    expect(TEXTOS_RESUMEN_IA.vigencia.DESACTUALIZADO).toMatch(/^DESACTUALIZADO/);
  });

  it("con IA: «Análisis de la IA del …» con su fecha y hora, sobre el pie", () => {
    const raiz = pintar(conIa("DIARIO"));
    expect(texto(raiz.querySelector(".resumen-ia-analisis"))).toBe("Análisis de la IA del 17-mar-2027, 18:41");
  });

  it("el último rechazado: el motivo en palabras simples, a la vista y sin códigos", () => {
    const vista = { ...conIa("DIARIO"), rechazo: "El último análisis (17-mar-2027, 19:05) no pasó la revisión automática y no se muestra: no citó todas las cifras que debía." };
    const raiz = pintar(vista);
    expect(texto(raiz.querySelector(".resumen-ia-rechazo"))).toBe(vista.rechazo);
    expect(pintar(conIa("DIARIO")).querySelector(".resumen-ia-rechazo")).toBeNull();
  });

  it("sin IA: el pie «Resumen sin IA», sin hora de redacción ni vigencia", () => {
    const paquete = paqueteFicticio("ESCENARIOS");
    const raiz = pintar(elegirResumen({ tipo: "ESCENARIOS", publicado: null, hoy: { paquete, motivo: null } }).vista);
    expect(texto(raiz.querySelector(".resumen-ia-pie"))).toBe("Resumen sin IA");
    expect(raiz.querySelector(".resumen-ia-pie time")).toBeNull();
    expect(raiz.querySelector(".resumen-ia-analisis")).toBeNull();
    expect(raiz.querySelector(".resumen-ia-vigencia")).toBeNull();
  });

  it("no disponible: solo la nota, sin frases ni cifras", () => {
    const raiz = pintar(elegirResumen({ tipo: "REGLAS", publicado: null, hoy: { paquete: null, motivo: "OCUPADO" } }).vista);
    expect(texto(raiz.querySelector(".resumen-ia-nota"))).toBe(TEXTOS_RESUMEN_IA.notaMomento);
    expect(raiz.querySelector(".resumen-ia-frases")).toBeNull();
    expect(raiz.querySelector(".resumen-ia-cifras")).toBeNull();
  });

  it("IA apagada: la tarjeta lo dice en palabras simples, sin detalles de configuración", () => {
    const paquete = paqueteFicticio("DIARIO");
    const vista = elegirResumen({ tipo: "DIARIO", publicado: null, motivoSinIa: TEXTOS_RESUMEN_IA.iaApagada, hoy: { paquete, motivo: null } }).vista;
    const raiz = pintar(vista);
    expect(texto(raiz.querySelector(".resumen-ia-sin-ia"))).toBe("IA apagada");
    expect(texto(raiz)).not.toMatch(/config|modo|interruptor|demanda|tarea/i);
  });

  it("sin motivo no se pinta el párrafo de «IA apagada»", () => {
    expect(pintar(conIa("DIARIO")).querySelector(".resumen-ia-sin-ia")).toBeNull();
  });

  it("fallo y descarte se pintan cada uno en su párrafo", () => {
    const paquete = paqueteFicticio("DIARIO");
    const raiz = pintar({
      ...elegirResumen({ tipo: "DIARIO", publicado: null, hoy: { paquete, motivo: null } }).vista,
      fallo: "El último intento de análisis (17-mar-2027, 19:05) falló.", descartado: "El análisis guardado ya no pasa la revisión.",
    });
    expect(texto(raiz.querySelector(".resumen-ia-fallo"))).toBe("El último intento de análisis (17-mar-2027, 19:05) falló.");
    expect(texto(raiz.querySelector(".resumen-ia-descartado"))).toBe("El análisis guardado ya no pasa la revisión.");
    expect(pintar(conIa("DIARIO")).querySelector(".resumen-ia-fallo, .resumen-ia-descartado")).toBeNull();
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
      elegirResumen({ tipo: t, publicado: null, motivoSinIa: TEXTOS_RESUMEN_IA.iaApagada, hoy: { paquete: paqueteFicticio(t), motivo: null } }).vista,
      elegirResumen({ tipo: t, publicado: publicadoFicticio(paqueteFicticio(t), { salidaModelo: "x" }), hoy: { paquete: paqueteFicticio(t), motivo: null } }).vista,
      elegirResumen({ tipo: t, publicado: null, fallido: { fechaNegocio: "2027-03-17", generadoEn: new Date("2027-03-18T00:05:00.000Z") }, hoy: { paquete: paqueteFicticio(t), motivo: null } }).vista,
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
    // Solo los textos (los valores): los códigos del validador, que son las claves de los motivos, no se muestran.
    const valores = (o: object): string[] => Object.values(o).flatMap((v) => (typeof v === "string" ? [v] : typeof v === "object" && v !== null ? valores(v) : []));
    const fijos = JSON.stringify(valores(TEXTOS_RESUMEN_IA));
    expect(prohibidasEn(fijos)).toEqual([]);
  });

  it("control positivo: el detector muerde una frase de consejo plantada en la tarjeta", () => {
    const plantada = { ...conIa("DIARIO"), frases: ["Le recomendamos vender ya; es buen momento."] };
    expect(prohibidasEn(sinAviso(plantada))).toEqual(expect.arrayContaining(["recomendamos", "buen momento"]));
  });

  it("el aviso es exactamente el que pone el validador (no se edita en la pantalla)", () => {
    const paquete = paqueteFicticio("ESCENARIOS");
    const v = elegirResumen({ tipo: "ESCENARIOS", publicado: null, hoy: { paquete, motivo: null } }).vista;
    expect(v.aviso).toBe(AVISOS.ESCENARIOS);
    expect(conIa("DIARIO").aviso).toBe(AVISOS.DIARIO);
  });
});
