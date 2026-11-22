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

import { FilaRegla } from "@/app/edicion/plan/FilaRegla";
import { FormularioPlan } from "@/app/edicion/plan/FormularioPlan";
import { MENSAJES, TEXTOS_PLAN } from "@/app/edicion/textos";
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
/** El resumen de errores: una región con nombre que toma el foco (sin role="alert": el foco ya lo anuncia). */
const resumen = () => m.contenedor.querySelector<HTMLElement>(".edicion-resumen")!;

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

  it("al quitar una regla el foco no se pierde (va a la que queda en su lugar, o a «Agregar») y se anuncia", async () => {
    await pintar();
    const anuncio = () => texto(m.contenedor.querySelector(".edicion-anuncio"));
    expect(m.contenedor.querySelector(".edicion-anuncio")?.getAttribute("role")).toBe("status");
    expect(anuncio()).toBe("");
    await clic(boton("Quitar la regla 1"));
    expect(document.activeElement).toBe(porEtiqueta("Especie", reglas()[0]));
    expect(anuncio()).toBe("Se quitó la regla 1. Queda 1 regla.");
    await clic(boton("Quitar la regla 1"));
    expect(reglas()).toHaveLength(0);
    expect(document.activeElement).toBe(boton("Agregar una regla"));
    expect(anuncio()).toBe("Se quitó la regla 1. No queda ninguna regla.");
  });

  it("al quitar la última de varias, el foco va a la anterior", async () => {
    await pintar();
    await clic(boton("Quitar la regla 2"));
    expect(document.activeElement).toBe(porEtiqueta("Especie", reglas()[0]));
  });

  it("cada fila está memorizada: escribir en una regla no vuelve a pintar las demás (planes con muchas reglas)", () => {
    expect((FilaRegla as unknown as { $$typeof?: symbol }).$$typeof).toBe(Symbol.for("react.memo"));
  });

  it("dice qué es obligatorio: un aviso al comienzo, asociado al formulario", async () => {
    await pintar();
    const form = m.contenedor.querySelector("form")!;
    const aviso = document.getElementById("edicion-obligatorios")!;
    expect(texto(aviso)).toBe(TEXTOS_PLAN.OBLIGATORIOS);
    expect(form.getAttribute("aria-describedby")?.split(" ")).toContain("edicion-obligatorios");
    expect(form.getAttribute("aria-labelledby")).toBeNull();
  });

  it("si el navegador vuelve a la página desde su caché (atrás), el formulario se puede volver a enviar", async () => {
    await pintar();
    await enviar();
    await responder({ version: 4 }, 201);
    expect(ir).toHaveBeenCalledTimes(1);
    expect(boton("Guardar la versión nueva").getAttribute("aria-disabled")).toBe("true");
    await act(async () => {
      window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    });
    expect(boton("Guardar la versión nueva").getAttribute("aria-disabled")).toBe("false");
    await enviar();
    expect(fetchFalso).toHaveBeenCalledTimes(2);
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
    expect(document.activeElement).toBe(resumen());
    expect(resumen().getAttribute("role")).toBeNull();
    expect(texto(document.getElementById(resumen().getAttribute("aria-labelledby")!))).toBe(TEXTOS_PLAN.RESUMEN);
    expect(texto(resumen())).toContain(MENSAJES.NIVEL_NO_RECONOCIDO);
    // Cada error enlaza a su campo y lo enfoca.
    const enlace = [...resumen().querySelectorAll("a")].find((a) => texto(a).includes(MENSAJES.NIVEL_NO_RECONOCIDO))!;
    await clic(enlace);
    expect(document.activeElement).toBe(porEtiqueta("Nivel", reglas()[0]));
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
    expect(texto(resumen())).toContain(MENSAJES.PLAN_CAMBIO);
    expect(document.activeElement).toBe(resumen());
    fetchFalso.mockRejectedValueOnce(new TypeError("red"));
    await enviar();
    expect(texto(resumen())).toContain(MENSAJES.DESCONOCIDO);
  });

  it("avisa en la regla cuyo plazo es anterior a la fecha de la versión (el dominio la rechazaría)", async () => {
    await m.pintar(createElement(FormularioPlan, { datos: { ...DATOS, reglas: [{ ...DATOS.reglas[0]!, plazoHasta: "2027-01-31" }, DATOS.reglas[1]!] } }));
    expect(texto(reglas()[0])).toContain("Su plazo es anterior a la fecha de la versión");
    expect(texto(reglas()[1])).not.toContain("Su plazo es anterior");
    await escribir(porEtiqueta("Rige desde"), "2027-01-20");
    expect(texto(reglas()[0])).not.toContain("Su plazo es anterior");
  });

  it("avisa si la base no es la vigente y si la fecha elegida ya pasó (no la cambia)", async () => {
    await m.pintar(createElement(FormularioPlan, { datos: { ...DATOS, base: { numero: 2, desde: "2021-06-01", tipo: "HISTORICA" } } }));
    expect(texto(m.contenedor)).toContain("versión 2");
    // La región del aviso está desde el comienzo (vacía), así el lector de pantalla anuncia el cambio.
    const aviso = m.contenedor.querySelector(".edicion-aviso-fecha")!;
    expect(aviso.getAttribute("role")).toBe("status");
    expect(texto(aviso)).toBe("");
    await escribir(porEtiqueta("Rige desde"), "2027-02-01");
    expect(texto(m.contenedor.querySelector(".edicion-aviso-fecha"))).toContain("ya pasó");
  });
});
