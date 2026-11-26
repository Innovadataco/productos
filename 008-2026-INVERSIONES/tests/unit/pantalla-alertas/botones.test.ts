// @vitest-environment jsdom
// «Marcar como vista» y «Marcar todas»: con 200 piden a Next que refresque (sin recargar la página) y devuelven el foco al encabezado;
// «Marcando…» se anuncia en una región de estado; los errores salen en role="alert"; un solo envío a la vez.
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { BotonMarcar } from "@/app/alertas/BotonesVista";
import { TEXTOS_ALERTAS_PANTALLA } from "@/app/alertas/textos";
import { montar, texto, type Montaje } from "../graficas/dom";

let m: Montaje;
let respuestas: ((r: Response) => void)[];
const fetchFalso = vi.fn((_u: string, _i: RequestInit) => new Promise<Response>((r) => respuestas.push(r)));

beforeEach(() => {
  respuestas = [];
  fetchFalso.mockClear();
  refresh.mockClear();
  vi.stubGlobal("fetch", fetchFalso);
  m = montar();
  document.body.insertAdjacentHTML("afterbegin", '<h1 id="t-hero" tabindex="-1">Alertas</h1>');
});
afterEach(() => {
  m.desmontar();
  document.getElementById("t-hero")?.remove();
  vi.unstubAllGlobals();
});
const boton = () => m.contenedor.querySelector("button")!;
const responder = async (estado: number) => act(async () => { respuestas.shift()!(new Response("{}", { status: estado })); });

describe("BotonMarcar", () => {
  it("con 200 refresca sin recargar, devuelve el foco al encabezado y manda solo el id", async () => {
    const recarga = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload: recarga });
    await m.pintar(createElement(BotonMarcar, { pedido: { alertaId: "a-1" }, texto: TEXTOS_ALERTAS_PANTALLA.MARCAR, etiqueta: "Marcar como vista: Movimiento del día del 25-nov-2026" }));
    expect(boton().getAttribute("aria-label")).toBe("Marcar como vista: Movimiento del día del 25-nov-2026");
    await act(async () => boton().click());
    expect(JSON.parse(String(fetchFalso.mock.calls[0]![1].body))).toEqual({ alertaId: "a-1" });
    await responder(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(recarga).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.getElementById("t-hero"));
  });

  it("mientras envía anuncia «Marcando…» en una región de estado y un segundo clic no manda otro pedido", async () => {
    await m.pintar(createElement(BotonMarcar, { pedido: { todas: true }, texto: TEXTOS_ALERTAS_PANTALLA.MARCAR_TODAS }));
    await act(async () => boton().click());
    await act(async () => boton().click());
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(texto(m.contenedor.querySelector('[role="status"]'))).toBe(TEXTOS_ALERTAS_PANTALLA.MARCANDO);
    await responder(200);
    expect(texto(m.contenedor.querySelector('[role="status"]'))).toBe("");
  });

  it("con error lo dice en role=alert y no refresca; con 401, la sesión vencida", async () => {
    await m.pintar(createElement(BotonMarcar, { pedido: { alertaId: "a-1" }, texto: TEXTOS_ALERTAS_PANTALLA.MARCAR }));
    await act(async () => boton().click());
    await responder(500);
    expect(texto(m.contenedor.querySelector('[role="alert"]'))).toBe(TEXTOS_ALERTAS_PANTALLA.ERROR_MARCAR);
    await act(async () => boton().click());
    await responder(401);
    expect(texto(m.contenedor.querySelector('[role="alert"]'))).toBe(TEXTOS_ALERTAS_PANTALLA.SESION_VENCIDA);
    expect(refresh).not.toHaveBeenCalled();
  });
});
