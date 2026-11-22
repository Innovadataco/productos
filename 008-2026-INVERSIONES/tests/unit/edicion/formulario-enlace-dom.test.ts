// @vitest-environment jsdom
// Enlazar después una orden importada de Trii a una decisión vigente (fase B, PR-B): se elige entre las órdenes que
// el servidor ya filtró (aprobadas, sin decisión, de la especie y del lado, no anteriores a la decisión); envía solo la
// decisión y la orden; con 201 vuelve a la cadena. Sin órdenes posibles, lo dice y no hay botón. Datos inventados.
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ir = vi.hoisted(() => vi.fn());
vi.mock("@/app/edicion/enviar", async (original) => ({ ...(await original<typeof import("@/app/edicion/enviar")>()), irA: ir }));

import { FormularioEnlace } from "@/app/edicion/enlace/FormularioEnlace";
import { MENSAJES } from "@/app/edicion/textos";
import type { DatosEdicionEnlace } from "@/app/edicion/tipos";
import { montar, texto, type Montaje } from "../graficas/dom";

type Listo = Extract<DatosEdicionEnlace, { estado: "LISTO" }>;
const DATOS: Listo = {
  estado: "LISTO",
  decision: { id: "decision-a", texto: "Vender · FICTA · 8-feb-2027" },
  ordenes: [
    { id: "o-1", instrumentoId: "inst-a", fecha: "2027-02-08", lado: "VENTA", texto: "8-feb-2027 · FICTA · Venta de 37" },
    { id: "o-2", instrumentoId: "inst-a", fecha: "2027-02-09", lado: "VENTA", texto: "9-feb-2027 · FICTA · Venta de 41" },
  ],
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

const selector = () => m.contenedor.querySelector<HTMLSelectElement>("#enlace-orden")!;
const boton = () => [...m.contenedor.querySelectorAll("button")].find((b) => texto(b) === "Enlazar la orden") as HTMLButtonElement | undefined;
const responder = async (cuerpo: unknown, estado: number) => {
  await act(async () => { respuestas.shift()!(new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } })); });
};

describe("FormularioEnlace", () => {
  it("la orden con su etiqueta; envía solo la decisión y la orden elegida; con 201 vuelve a la cadena", async () => {
    await m.pintar(createElement(FormularioEnlace, { datos: DATOS }));
    expect(texto(m.contenedor.querySelector(`label[for="enlace-orden"]`))).toBe("Orden de Trii");
    expect([...selector().options].map((o) => o.value)).toEqual(["o-1", "o-2"]);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(selector(), "o-2");
      selector().dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => { boton()!.click(); });
    const [url, init] = fetchFalso.mock.calls[0]!;
    expect(url).toBe("/api/decisiones/enlaces");
    expect(JSON.parse(String(init.body))).toEqual({ decisionId: "decision-a", ordenId: "o-2" });
    await responder({ decisionId: "decision-a" }, 201);
    expect(ir).toHaveBeenCalledWith("/decisiones/decision-a");
  });

  it("con 409 (la orden ya se enlazó en otra pestaña) muestra el mensaje del código", async () => {
    await m.pintar(createElement(FormularioEnlace, { datos: DATOS }));
    await act(async () => { boton()!.click(); });
    await responder({ error: "x", codigo: "ORDEN_YA_ENLAZADA", campos: [] }, 409);
    expect(texto(m.contenedor.querySelector("[role=alert]"))).toContain(MENSAJES.ORDEN_YA_ENLAZADA);
    expect(ir).not.toHaveBeenCalled();
  });

  it("sin órdenes posibles lo dice y no hay botón", async () => {
    await m.pintar(createElement(FormularioEnlace, { datos: { ...DATOS, ordenes: [] } }));
    expect(boton()).toBeUndefined();
    expect(texto(m.contenedor)).toContain(MENSAJES.SIN_ORDENES_POSIBLES);
  });
});
