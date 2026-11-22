// @vitest-environment jsdom
// El formulario de una decisión del diario (fase B, PR-B) en el navegador: la regla que cita se elige entre las de la
// versión vigente en la fecha de la decisión, de esa especie o del portafolio; la orden de Trii, entre las aprobadas sin
// decisión de esa especie, del lado de la acción y no anteriores a la decisión («no actuar» no lleva orden); la
// excepción solo con regla citada. Envía exactamente lo que espera la ruta; en una corrección, `corrige` y nunca una
// orden. Con 201 va a la cadena de la decisión nueva. Datos inventados.
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ir = vi.hoisted(() => vi.fn());
vi.mock("@/app/edicion/enviar", async (original) => ({ ...(await original<typeof import("@/app/edicion/enviar")>()), irA: ir }));

import { FormularioDecision } from "@/app/edicion/decision/FormularioDecision";
import { MENSAJES, TEXTOS_DECISION, TEXTOS_PLAN } from "@/app/edicion/textos";
import type { DatosEdicionDecision } from "@/app/edicion/tipos";
import { montar, texto, type Montaje } from "../graficas/dom";

type Listo = Extract<DatosEdicionDecision, { estado: "LISTO" }>;
const DATOS: Listo = {
  estado: "LISTO",
  hoy: "2027-02-10",
  especies: [{ id: "inst-a", nemotecnico: "FICTA" }, { id: "inst-b", nemotecnico: "FICTB" }],
  versiones: [
    { numero: 1, desde: "2021-01-04", reglas: [{ id: "r-v1-a", instrumentoId: "inst-a", accion: "VENDER", texto: "FICTA · Cierre por encima de $ 1.200 → vender" }] },
    {
      numero: 2, desde: "2027-01-04",
      reglas: [
        { id: "r-v2-a", instrumentoId: "inst-a", accion: "NO_ACTUAR", texto: "FICTA · Sin condición → no actuar" },
        { id: "r-v2-b", instrumentoId: "inst-b", accion: "COMPRAR", texto: "FICTB · Cierre por debajo de $ 480 → comprar" },
        { id: "r-v2-p", instrumentoId: null, accion: "NO_ACTUAR", texto: "Portafolio · Regla escrita → no actuar" },
      ],
    },
  ],
  ordenes: [
    { id: "o-venta-a", instrumentoId: "inst-a", fecha: "2027-02-08", lado: "VENTA", texto: "8-feb-2027 · FICTA · Venta de 37" },
    { id: "o-compra-a", instrumentoId: "inst-a", fecha: "2027-02-09", lado: "COMPRA", texto: "9-feb-2027 · FICTA · Compra de 41" },
    { id: "o-venta-vieja", instrumentoId: "inst-a", fecha: "2027-01-02", lado: "VENTA", texto: "2-ene-2027 · FICTA · Venta de 13" },
  ],
  inicial: { fechaDecision: "2027-02-08", instrumentoId: "inst-a", accion: "VENDER", cantidad: "", reglaId: "", excepcion: false, motivo: "", ordenId: "" },
  corrige: null,
};

let m: Montaje;
let respuestas: ((r: Response) => void)[];
const fetchFalso = vi.fn((_url: string, _init: RequestInit) => new Promise<Response>((r) => respuestas.push(r)));

beforeEach(() => {
  respuestas = [];
  fetchFalso.mockClear();
  ir.mockClear();
  vi.stubGlobal("fetch", fetchFalso);
  m = montar();
});
afterEach(() => {
  m.desmontar();
  vi.unstubAllGlobals();
});

const pintar = (datos: Listo = DATOS) => m.pintar(createElement(FormularioDecision, { datos }));
const control = (etiqueta: string) => {
  const label = [...m.contenedor.querySelectorAll("label")].find((l) => texto(l) === etiqueta);
  if (!label) throw new Error(`sin etiqueta «${etiqueta}»`);
  return document.getElementById(label.htmlFor) as HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement;
};
const opciones = (etiqueta: string) => [...control(etiqueta).options].map((o) => o.value);
const resumen = () => m.contenedor.querySelector<HTMLElement>(".edicion-resumen")!;
const boton = (t: string) => [...m.contenedor.querySelectorAll("button")].find((b) => texto(b) === t) as HTMLButtonElement;
async function escribir(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, valor: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, valor);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
const clic = (b: HTMLElement) => act(async () => { b.click(); });
const responder = async (cuerpo: unknown, estado: number) => {
  await act(async () => { respuestas.shift()!(new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } })); });
};

describe("FormularioDecision · reglas y órdenes que se pueden citar", () => {
  it("las reglas de la versión vigente en la fecha, de la especie o del portafolio", async () => {
    await pintar();
    expect(opciones("Regla que cita")).toEqual(["", "r-v2-a", "r-v2-p"]);
    await escribir(control("Fecha de la decisión"), "2026-12-30");
    expect(opciones("Regla que cita")).toEqual(["", "r-v1-a"]);
    await escribir(control("Fecha de la decisión"), "2027-02-08");
    await escribir(control("Especie"), "inst-b");
    expect(opciones("Regla que cita")).toEqual(["", "r-v2-b", "r-v2-p"]);
  });

  it("si cambia la fecha o la especie y la regla elegida ya no aplica, se suelta (no se envía una regla de otra versión)", async () => {
    await pintar();
    await escribir(control("Regla que cita"), "r-v2-a");
    await escribir(control("Fecha de la decisión"), "2026-12-30");
    expect(control("Regla que cita").value).toBe("");
  });

  it("las órdenes: de la especie, del lado de la acción y no anteriores a la decisión; «no actuar» no lleva orden", async () => {
    await pintar();
    expect(opciones("Orden de Trii (opcional)")).toEqual(["", "o-venta-a"]);
    await escribir(control("Qué decidió"), "COMPRAR");
    expect(opciones("Orden de Trii (opcional)")).toEqual(["", "o-compra-a"]);
    await escribir(control("Qué decidió"), "NO_ACTUAR");
    expect(m.contenedor.querySelector("#decision-orden")).toBeNull();
    expect(texto(m.contenedor)).toContain("«No actuar» no lleva orden");
  });

  it("la excepción solo con una regla citada, y deshabilitada dice por qué", async () => {
    await pintar();
    const excepcion = control("Se aparta de la acción de la regla (excepción)");
    expect(excepcion.disabled).toBe(true);
    const ayuda = document.getElementById("decision-excepcion-ayuda")!;
    expect(texto(ayuda)).toBe(TEXTOS_DECISION.AYUDA_EXCEPCION);
    expect(excepcion.getAttribute("aria-describedby")?.split(" ")).toContain("decision-excepcion-ayuda");
    await escribir(control("Regla que cita"), "r-v2-a");
    expect(control("Se aparta de la acción de la regla (excepción)").disabled).toBe(false);
  });

  it("lo que se soltó no vuelve solo: cambiar la fecha y volver no recupera la regla ni la excepción", async () => {
    await pintar();
    await escribir(control("Regla que cita"), "r-v2-a");
    await act(async () => { control("Se aparta de la acción de la regla (excepción)").click(); });
    await escribir(control("Fecha de la decisión"), "2026-12-30");
    await escribir(control("Fecha de la decisión"), "2027-02-08");
    expect(control("Regla que cita").value).toBe("");
    expect(control("Se aparta de la acción de la regla (excepción)").checked).toBe(false);
    await escribir(control("Orden de Trii (opcional)"), "o-venta-a");
    await escribir(control("Qué decidió"), "COMPRAR");
    await escribir(control("Qué decidió"), "VENDER");
    expect(control("Orden de Trii (opcional)").value).toBe("");
  });

  it("dice qué es obligatorio, con un aviso asociado al formulario", async () => {
    await pintar();
    expect(texto(document.getElementById("edicion-obligatorios"))).toBe(TEXTOS_PLAN.OBLIGATORIOS);
    expect(m.contenedor.querySelector("form")!.getAttribute("aria-describedby")?.split(" ")).toContain("edicion-obligatorios");
  });
});

describe("FormularioDecision · envío", () => {
  it("una decisión nueva con su orden: exactamente los campos de la ruta; con 201 va a su cadena", async () => {
    await pintar();
    await escribir(control("Cantidad"), "37");
    await escribir(control("Por qué"), "Vender una parte (ficticio)");
    await escribir(control("Orden de Trii (opcional)"), "o-venta-a");
    await clic(boton("Registrar la decisión"));
    const [url, init] = fetchFalso.mock.calls[0]!;
    expect(url).toBe("/api/decisiones");
    expect(JSON.parse(String(init.body))).toEqual({
      fechaDecision: "2027-02-08", instrumentoId: "inst-a", accion: "VENDER", cantidad: "37", reglaId: null, excepcion: false, motivo: "Vender una parte (ficticio)", ordenId: "o-venta-a", corrige: null,
    });
    await responder({ id: "decision-nueva" }, 201);
    expect(ir).toHaveBeenCalledWith("/decisiones/decision-nueva");
  });

  it("una corrección: lleva `corrige`, nunca una orden (las de la anterior pasan solas), y lo dice", async () => {
    await pintar({ ...DATOS, inicial: { ...DATOS.inicial, motivo: "Vender (ficticio)", reglaId: "r-v2-a", accion: "NO_ACTUAR", cantidad: "37" }, corrige: { id: "decision-vieja", fecha: "2027-02-08", especie: "FICTA" } });
    expect(texto(m.contenedor)).toContain("Corrige la decisión del 8-feb-2027");
    expect(m.contenedor.querySelector("#decision-orden")).toBeNull();
    await clic(boton("Registrar la corrección"));
    expect(JSON.parse(String(fetchFalso.mock.calls[0]![1].body))).toMatchObject({ corrige: "decision-vieja", ordenId: null, reglaId: "r-v2-a", accion: "NO_ACTUAR" });
  });

  it("con 400 marca los campos (aria-invalid y su mensaje) y el resumen toma el foco", async () => {
    await pintar();
    await clic(boton("Registrar la decisión"));
    await responder({ error: "x", codigo: "DATOS_INVALIDOS", campos: [{ campo: "motivo", codigo: "VACIO" }, { campo: "accion", codigo: "ACCION_DISTINTA_SIN_EXCEPCION" }] }, 400);
    expect(document.activeElement).toBe(resumen());
    expect(control("Por qué").getAttribute("aria-invalid")).toBe("true");
    expect(texto(resumen())).toContain(MENSAJES.ACCION_DISTINTA_SIN_EXCEPCION);
    // El error del campo enlaza a su control.
    const enlace = [...resumen().querySelectorAll("a")].find((a) => texto(a).includes(MENSAJES.VACIO))!;
    expect(enlace.getAttribute("href")).toBe("#decision-motivo");
  });

  it("sin sesión (401): pide volver a ingresar", async () => {
    await pintar();
    await clic(boton("Registrar la decisión"));
    await responder({ error: "No autenticado" }, 401);
    expect(texto(resumen())).toContain(MENSAJES.SESION_VENCIDA);
  });
});
