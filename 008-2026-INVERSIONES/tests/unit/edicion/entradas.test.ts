// @vitest-environment jsdom
// Las entradas al área de edición (fase B, PR-B) desde las pantallas de lectura: solo el dueño las ve, y son enlaces
// (sin formularios ni JavaScript en esas pantallas). Plan → «Nueva versión del plan» (también sin plan); diario →
// «Registrar una decisión»; cadena de una decisión vigente → «Corregir esta decisión» y, si no es «no actuar»,
// «Enlazar una orden de Trii». La familia no ve ninguna. Datos inventados (tests/unit/plan/ficticio-pantallas.ts).
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { aVistaDecision, aVistaDiario } from "@/app/_plan/serializar";
import { Cadena } from "@/app/decisiones/[id]/Cadena";
import { Diario } from "@/app/decisiones/Diario";
import { Plan } from "@/app/plan/Plan";
import { aVistaPlan } from "@/app/plan/vista";
import { CALENDARIO, CIERRES, DETALLE, DETALLE_VENTA, DETALLE_VIEJA, DIARIO, REFERENCIA, REGLAS_V1, VERSIONES, dia } from "../plan/ficticio-pantallas";

const pintar = (el: ReactElement): HTMLElement => {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(el);
  return raiz;
};
const enlaces = (raiz: HTMLElement) => Object.fromEntries([...raiz.querySelectorAll("main a")].map((a) => [(a.textContent ?? "").trim(), a.getAttribute("href")]));
const formularios = (raiz: HTMLElement) => raiz.querySelectorAll("form, button, input, select, textarea").length;

const HOY = dia("2024-11-25");
const PLAN = {
  estado: "VERSION" as const,
  vista: aVistaPlan({ versiones: VERSIONES, elegida: VERSIONES.find((v) => v.version === 1)!, reglas: REGLAS_V1, cierres: { porEspecie: CIERRES, calendario: CALENDARIO, referencia: REFERENCIA }, hoy: HOY }),
  versiones: [],
};
const DIARIO_VISTA = aVistaDiario(DIARIO, null, false);

describe("entradas al área de edición", () => {
  it("plan: el dueño ve «Nueva versión del plan»; sin plan, «Crear la primera versión»; la familia, nada", () => {
    expect(enlaces(pintar(createElement(Plan, { datos: PLAN })))["Nueva versión del plan"]).toBe("/edicion/plan");
    expect(enlaces(pintar(createElement(Plan, { datos: { estado: "SIN_PLAN" } })))["Crear la primera versión del plan"]).toBe("/edicion/plan");
    for (const datos of [PLAN, { estado: "SIN_PLAN" } as const]) {
      const familia = pintar(createElement(Plan, { datos, soloLectura: true }));
      expect(familia.querySelector('a[href^="/edicion"]')).toBeNull();
    }
    expect(formularios(pintar(createElement(Plan, { datos: PLAN })))).toBe(0);
  });

  it("diario: el dueño ve «Registrar una decisión»; la familia, no", () => {
    expect(enlaces(pintar(createElement(Diario, { vista: DIARIO_VISTA })))["Registrar una decisión"]).toBe("/edicion/decision");
    expect(pintar(createElement(Diario, { vista: DIARIO_VISTA, soloLectura: true })).querySelector('a[href^="/edicion"]')).toBeNull();
    expect(formularios(pintar(createElement(Diario, { vista: DIARIO_VISTA })))).toBe(0);
  });

  it("cadena: corregir y enlazar una orden si está vigente; «no actuar» no enlaza; una corregida, ninguna", () => {
    const venta = pintar(createElement(Cadena, { datos: { estado: "DECISION", vista: aVistaDecision(DETALLE_VENTA) } }));
    const id = encodeURIComponent(DETALLE_VENTA.decision.id);
    expect(enlaces(venta)["Corregir esta decisión"]).toBe(`/edicion/decision?corrige=${id}`);
    expect(enlaces(venta)["Enlazar una orden de Trii"]).toBe(`/edicion/enlace?decision=${id}`);
    const noActuar = pintar(createElement(Cadena, { datos: { estado: "DECISION", vista: aVistaDecision(DETALLE) } }));
    expect(DETALLE.decision.accion).toBe("NO_ACTUAR");
    expect(enlaces(noActuar)["Corregir esta decisión"]).toBe(`/edicion/decision?corrige=${encodeURIComponent(DETALLE.decision.id)}`);
    expect(enlaces(noActuar)["Enlazar una orden de Trii"]).toBeUndefined();
    expect(DETALLE_VIEJA.decision.reemplazadaPor).not.toBeNull();
    const vieja = pintar(createElement(Cadena, { datos: { estado: "DECISION", vista: aVistaDecision(DETALLE_VIEJA) } }));
    // En el contenido: el menú del dueño lleva «Configuración» (/edicion) en todas las pantallas (frente menu-configuracion).
    expect(vieja.querySelector('main a[href^="/edicion"]')).toBeNull();
    const familia = pintar(createElement(Cadena, { datos: { estado: "DECISION", vista: aVistaDecision(DETALLE_VENTA) }, soloLectura: true }));
    expect(familia.querySelector('a[href^="/edicion"]')).toBeNull();
    expect(formularios(venta)).toBe(0);
  });
});
