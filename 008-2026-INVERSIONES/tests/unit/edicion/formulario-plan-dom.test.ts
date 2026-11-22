// @vitest-environment jsdom
// El formulario de la versión nueva del plan (fase B, PR-B) en el navegador: precarga la versión base con sus reglas,
// cada campo con su etiqueta; agregar y quitar reglas; el envío por fetch con EXACTAMENTE lo que espera la ruta (y la
// última versión que vio); un segundo envío mientras va el primero se ignora; con 400, el resumen de errores en un
// role="alert" que toma el foco, y cada campo marcado (aria-invalid y su mensaje); con 201, va a la versión nueva.
// Datos inventados.
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const ir = vi.hoisted(() => vi.fn());
vi.mock("@/app/edicion/enviar", async (original) => ({ ...(await original<typeof import("@/app/edicion/enviar")>()), irA: ir }));

import { FormularioPlan } from "@/app/edicion/plan/FormularioPlan";
import { MENSAJES } from "@/app/edicion/textos";
import type { DatosEdicionPlan } from "@/app/edicion/tipos";
import { montar, texto, type Montaje } from "../graficas/dom";

const DATOS: DatosEdicionPlan = {
  hoy: "2027-02-10",
  ultima: { numero: 3, desde: "2027-01-04", tipo: "VIGENTE" },
  base: { numero: 3, desde: "2027-01-04", tipo: "VIGENTE" },
  versiones: [{ numero: 3, desde: "2027-01-04", tipo: "VIGENTE" }, { numero: 2, desde: "2021-06-01", tipo: "HISTORICA" }],
  especies: [{ id: "inst-a", nemotecnico: "FICTA" }, { id: "inst-b", nemotecnico: "FICTB" }],
  reglas: [
    { instrumentoId: "inst-a", condicion: "CIERRE_SOBRE", nivel: "1.237,5", accion: "VENDER", cantidad: "37", plazoHasta: "", detalle: "Vender sobre el nivel (ficticia)" },
    { instrumentoId: null, condicion: "LIBRE", nivel: "", accion: "NO_ACTUAR", cantidad: "", plazoHasta: "", detalle: "Siempre orden límite (ficticia)" },
  ],
  vigenteDesde: "2027-02-10",
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

const pintar = () => m.pintar(createElement(FormularioPlan, { datos: DATOS }));
const porEtiqueta = (etiqueta: string, dentro: ParentNode = m.contenedor) => {
  const label = [...dentro.querySelectorAll("label")].find((l) => texto(l) === etiqueta);
  if (!label) throw new Error(`sin etiqueta «${etiqueta}»`);
  return document.getElementById(label.htmlFor) as HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement;
};
const reglas = () => [...m.contenedor.querySelectorAll("fieldset.edicion-regla")];
const boton = (t: string) => [...m.contenedor.querySelectorAll("button")].find((b) => texto(b) === t || b.getAttribute("aria-label") === t) as HTMLButtonElement;
const responder = async (cuerpo: unknown, estado: number) => {
  await act(async () => { respuestas.shift()!(new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } })); });
};

/** Cambia un control como lo hace React con el usuario (setter nativo + evento). */
async function escribir(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, valor: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, valor);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
const clic = (b: HTMLElement) => act(async () => { b.click(); });
const enviar = () => clic(boton("Guardar la versión nueva"));

describe("FormularioPlan", () => {
  it("precarga la base: vigencia, cada regla con su especie, condición, nivel es-CO, acción, cantidad y detalle", async () => {
    await pintar();
    expect(texto(m.contenedor.querySelector("h2"))).toContain("Reglas");
    expect(porEtiqueta("Rige desde").value).toBe("2027-02-10");
    expect(porEtiqueta("Rige desde").min).toBe("2027-01-04");
    expect(reglas()).toHaveLength(2);
    const [r1, r2] = reglas();
    expect(texto(r1!.querySelector("legend"))).toBe("Regla 1");
    expect(porEtiqueta("Especie", r1).value).toBe("inst-a");
    expect(porEtiqueta("Condición", r1).value).toBe("CIERRE_SOBRE");
    expect(porEtiqueta("Nivel", r1).value).toBe("1.237,5");
    expect(porEtiqueta("Acción de la regla", r1).value).toBe("VENDER");
    expect(porEtiqueta("Cantidad", r1).value).toBe("37");
    expect(porEtiqueta("Detalle", r1).value).toBe("Vender sobre el nivel (ficticia)");
    expect(porEtiqueta("Especie", r2).value).toBe("");
    expect([...porEtiqueta("Especie", r2).options].map((o) => o.text)).toEqual(["Portafolio (todas las especies)", "FICTA", "FICTB"]);
    // Sin nivel donde la condición no lo lleva: el campo queda deshabilitado y vacío.
    expect(porEtiqueta("Nivel", r2).disabled).toBe(true);
  });

  it("agregar y quitar reglas (cada botón dice cuál quita); el foco va a la regla nueva", async () => {
    await pintar();
    await clic(boton("Agregar una regla"));
    expect(reglas()).toHaveLength(3);
    expect(document.activeElement).toBe(porEtiqueta("Especie", reglas()[2]));
    await clic(boton("Quitar la regla 1"));
    expect(reglas()).toHaveLength(2);
    expect(porEtiqueta("Detalle", reglas()[0]).value).toBe("Siempre orden límite (ficticia)");
    expect(texto(reglas()[0]!.querySelector("legend"))).toBe("Regla 1");
  });

  it("envía por fetch exactamente lo que espera la ruta, con la última versión que vio; con 201 va a la versión nueva", async () => {
    await pintar();
    await escribir(porEtiqueta("Motivo del cambio"), "Ajuste ficticio");
    await escribir(porEtiqueta("Nivel", reglas()[0]), "1.300");
    await escribir(porEtiqueta("Condición", reglas()[1]), "MONTO_ORDEN_BAJO");
    await escribir(porEtiqueta("Nivel", reglas()[1]), "4.613.000");
    await enviar();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFalso.mock.calls[0]!;
    expect(url).toBe("/api/plan/versiones");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      vigenteDesde: "2027-02-10", motivo: "Ajuste ficticio", versionBase: 3,
      reglas: [
        { instrumentoId: "inst-a", condicion: "CIERRE_SOBRE", nivel: "1.300", accion: "VENDER", cantidad: "37", plazoHasta: "", detalle: "Vender sobre el nivel (ficticia)" },
        { instrumentoId: null, condicion: "MONTO_ORDEN_BAJO", nivel: "4.613.000", accion: "NO_ACTUAR", cantidad: "", plazoHasta: "", detalle: "Siempre orden límite (ficticia)" },
      ],
    });
    // Un segundo envío mientras va el primero se ignora.
    await enviar();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    await responder({ version: 4 }, 201);
    expect(ir).toHaveBeenCalledWith("/plan?version=4");
  });

  it("con 400: resumen de errores con foco, cada campo marcado con su mensaje; se puede corregir y reenviar", async () => {
    await pintar();
    await enviar();
    await responder({ error: "x", codigo: "DATOS_INVALIDOS", campos: [{ campo: "motivo", codigo: "VACIO" }, { campo: "reglas[0].nivel", codigo: "NIVEL_NO_RECONOCIDO" }] }, 400);
    const resumen = m.contenedor.querySelector<HTMLElement>("[role=alert]")!;
    expect(document.activeElement).toBe(resumen);
    expect(texto(resumen)).toContain(MENSAJES.NIVEL_NO_RECONOCIDO);
    const nivel = porEtiqueta("Nivel", reglas()[0]);
    expect(nivel.getAttribute("aria-invalid")).toBe("true");
    expect(texto(document.getElementById(nivel.getAttribute("aria-describedby")!.split(" ").at(-1)!))).toBe(MENSAJES.NIVEL_NO_RECONOCIDO);
    expect(porEtiqueta("Motivo del cambio").getAttribute("aria-invalid")).toBe("true");
    expect(ir).not.toHaveBeenCalled();
    await enviar();
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it("con 409 (otra versión entró): el mensaje del código, sin campos; con un fallo de red, el genérico", async () => {
    await pintar();
    await enviar();
    await responder({ error: "x", codigo: "PLAN_CAMBIO", campos: [] }, 409);
    expect(texto(m.contenedor.querySelector("[role=alert]"))).toContain(MENSAJES.PLAN_CAMBIO);
    fetchFalso.mockRejectedValueOnce(new TypeError("red"));
    await enviar();
    expect(texto(m.contenedor.querySelector("[role=alert]"))).toContain(MENSAJES.DESCONOCIDO);
  });

  it("avisa si la base no es la vigente y si la fecha elegida ya pasó (no la cambia)", async () => {
    await m.pintar(createElement(FormularioPlan, { datos: { ...DATOS, base: { numero: 2, desde: "2021-06-01", tipo: "HISTORICA" } } }));
    expect(texto(m.contenedor)).toContain("versión 2");
    await escribir(porEtiqueta("Rige desde"), "2027-02-01");
    expect(texto(m.contenedor.querySelector(".edicion-aviso-fecha"))).toContain("ya pasó");
  });
});
