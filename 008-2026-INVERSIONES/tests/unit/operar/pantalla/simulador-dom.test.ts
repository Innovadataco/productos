// @vitest-environment jsdom
// La sección «¿Y si…?» de /operar en el navegador: manda a POST /api/operar/simular la especie, el lado, la cantidad, el
// precio y el comisionista tal como se escribieron; muestra la vista que vuelve (como texto), los errores del dueño en
// una alerta y un mensaje por estado HTTP (401, 429, 400, 500 o una respuesta rara). Sin especies, lo dice. Y /operar
// la pinta solo con las especies (cambio aditivo). Datos inventados.
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Operar } from "@/app/operar/Operar";
import { aVistaOperar } from "@/app/operar/serializar";
import { Simulador } from "@/app/operar/Simulador";
import { TEXTOS_SIMULADOR as T } from "@/app/operar/textos-simulador";
import type { VistaSimulacion } from "@/app/operar/tipos-simulador";
import { armarInforme } from "@/operar/informe/armar";
import { montar, texto, type Montaje } from "../../graficas/dom";
import { entradasCompletas, HOY } from "../informe/ficticio";

const ESPECIES = [{ id: "id-ficticia-a", nemotecnico: "FICTICIA-A", cantidad: "1.237" }, { id: "id-ficticia-b", nemotecnico: "FICTICIA-B", cantidad: "379" }];
const VISTA: VistaSimulacion = {
  especies: [{ nemotecnico: "FICTICIA-A", operada: true, cantidadAntes: "1.237", cantidadDespues: "1.240", pesoAntes: "99,92 %", pesoDespues: "99,92 %" }],
  valorOrden: "$ 13.839,81",
  comision: { fuente: "TARIFA", valor: "$ 49,9523", texto: "calculada con su tarifa de Trii para compra · versión 3" },
  cajaAntes: "$ 37.911,47", cajaDespues: "$ 24.021,7077", cajaFuente: "Caja certificada por Acciones & Valores al 12-mar-2027.",
  valorAccionesAntes: "$ 5.711.154,47", valorAccionesDespues: "$ 5.725.004,28",
  reglas: [{ texto: "Su regla de FICTICIA-A dice: vender 41.", afectaciones: ["Su plan para esta especie dice: vender 41."] }],
  avisos: ["Aviso ficticio."], notas: ["Nota ficticia."],
};

let m: Montaje;
let respuestas: ((r: Response) => void)[];
const fetchFalso = vi.fn((_url: string, _init: RequestInit) => new Promise<Response>((r) => respuestas.push(r)));
beforeEach(() => {
  respuestas = [];
  fetchFalso.mockClear();
  vi.stubGlobal("fetch", fetchFalso);
  m = montar();
});
afterEach(() => {
  m.desmontar();
  vi.unstubAllGlobals();
});
const control = <T extends HTMLElement>(id: string) => m.contenedor.querySelector<T>(`#${id}`)!;
async function cambiar(el: HTMLInputElement | HTMLSelectElement, valor: string): Promise<void> {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, valor);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
const enviar = async () => act(async () => { m.contenedor.querySelector("form")!.requestSubmit(); });
const responder = async (cuerpo: unknown, estado: number) => {
  await act(async () => { respuestas.shift()!(new Response(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } })); });
};

describe("Simulador", () => {
  it("manda lo escrito y muestra la vista: valor, comisión de la tarifa, caja, pesos, reglas, avisos y notas", async () => {
    await m.pintar(createElement(Simulador, { especies: ESPECIES }));
    await cambiar(control("sim-especie"), "id-ficticia-b");
    await cambiar(control("sim-lado"), "VENDER");
    await cambiar(control("sim-cantidad"), "7");
    await cambiar(control("sim-precio"), "11,71");
    await cambiar(control("sim-comisionista"), "AV");
    await enviar();
    expect(texto(m.contenedor)).toContain(T.CALCULANDO);
    const [url, init] = fetchFalso.mock.calls[0]!;
    expect(url).toBe("/api/operar/simular");
    expect(JSON.parse(String(init.body))).toEqual({ instrumentoId: "id-ficticia-b", lado: "VENDER", cantidad: "7", precioLimite: "11,71", comisionista: "AV" });
    await responder({ ok: true, vista: VISTA }, 200);
    const todo = texto(m.contenedor);
    for (const t of ["$ 13.839,81", "$ 49,9523", "Comisión (de su tarifa)", "antes: $ 37.911,47", "después: $ 24.021,7077", "Caja certificada", "Su regla de FICTICIA-A dice", "Aviso ficticio.", "Nota ficticia."]) expect(todo).toContain(t);
    expect(m.contenedor.querySelector(".op-sim-operada th")?.textContent).toBe("FICTICIA-A");
  });

  it("sin reglas ni avisos, y sin valor de comisión, lo dice", async () => {
    await m.pintar(createElement(Simulador, { especies: ESPECIES }));
    await enviar();
    await responder({ ok: true, vista: { ...VISTA, reglas: [], avisos: [], comision: { fuente: "SIN_HISTORIA", valor: null, texto: "sin historia: no se estima" } } }, 200);
    expect(texto(m.contenedor)).toContain(T.SIN_REGLAS);
    expect(texto(m.contenedor)).toContain("Comisión (no se estima)");
    expect(m.contenedor.querySelector(".op-sim-avisos")).toBeNull();
  });

  it("los errores del dueño salen en una alerta", async () => {
    await m.pintar(createElement(Simulador, { especies: ESPECIES }));
    await enviar();
    await responder({ ok: false, errores: ["La cantidad no es un número entero mayor que cero."] }, 200);
    expect(texto(m.contenedor.querySelector("[role=alert]"))).toContain("La cantidad no es un número entero mayor que cero.");
  });

  it.each([
    [401, T.SESION], [429, T.DEMASIADAS], [400, T.INVALIDO], [500, T.FALLO],
  ])("con %i, su mensaje", async (estado, mensaje) => {
    await m.pintar(createElement(Simulador, { especies: ESPECIES }));
    await enviar();
    await responder({ error: "x" }, estado);
    expect(texto(m.contenedor.querySelector("[role=alert]"))).toContain(mensaje);
  });

  it("una respuesta rara o un fallo de red: el mensaje genérico", async () => {
    await m.pintar(createElement(Simulador, { especies: ESPECIES }));
    await enviar();
    await responder({ ok: true }, 200);
    expect(texto(m.contenedor.querySelector("[role=alert]"))).toContain(T.FALLO);
    fetchFalso.mockRejectedValueOnce(new Error("red"));
    await enviar();
    expect(texto(m.contenedor.querySelector("[role=alert]"))).toContain(T.FALLO);
  });

  it("sin especies no hay formulario", async () => {
    await m.pintar(createElement(Simulador, { especies: [] }));
    expect(m.contenedor.querySelector("form")).toBeNull();
    expect(texto(m.contenedor)).toContain(T.SIN_ESPECIES);
  });

  it("/operar la pinta solo con las especies", () => {
    const vista = aVistaOperar(armarInforme(entradasCompletas(), HOY));
    expect(renderToStaticMarkup(createElement(Operar, { vista }))).not.toContain(T.TITULO);
    expect(renderToStaticMarkup(createElement(Operar, { vista: { ...vista, especies: ESPECIES } }))).toContain(T.TITULO);
  });
});
