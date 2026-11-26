// @vitest-environment jsdom
// /edicion/tarifas (O5) en el navegador y en el servidor:
//  - la página exige al dueño ANTES de leer (la familia, 404 sin leer nada) y pinta las vigentes con su control, la
//    historia (con la recién guardada marcada) y el formulario; sin base, el aviso de siempre;
//  - el formulario envía lo escrito (con la última versión que vio y los otros cargos) a POST /api/operar/tarifas; con
//    201 recarga con la versión guardada; con 400 el resumen toma el foco y el campo queda marcado; hasta 3 cargos.
// Datos inventados.
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosEdicionTarifas } from "@/app/edicion/tarifas/tipos-tarifas";

const ir = vi.hoisted(() => vi.fn());
const exigirDueno = vi.hoisted(() => vi.fn());
const datosEdicionTarifas = vi.hoisted(() => vi.fn());
vi.mock("@/app/edicion/enviar", async (original) => ({ ...(await original<typeof import("@/app/edicion/enviar")>()), irA: ir }));
vi.mock("@/auth/sesion", () => ({ exigirDueno }));
vi.mock("@/lib/db", () => ({ db: { soy: "la base" } }));
vi.mock("@/app/edicion/tarifas/datos", () => ({ datosEdicionTarifas }));

import PaginaTarifas from "@/app/edicion/tarifas/page";
import { FormularioTarifa } from "@/app/edicion/tarifas/FormularioTarifa";
import { TEXTOS_TARIFAS, mensajeTarifa } from "@/app/edicion/tarifas/textos-tarifas";
import { montar, texto, type Montaje } from "../../graficas/dom";

const VISTA = { version: 3, comisionista: "Trii", lado: "Compra", desde: "11-ene-2027", detalle: "0,2731 % del valor (mínimo $ 7,13)", motivo: "motivo ficticio", creada: "11-ene-2027 18:41" };
const DATOS: DatosEdicionTarifas = {
  ultimaVersion: 3,
  hoy: "2027-03-17",
  vigentes: [
    { comisionista: "Trii", lado: "Compra", tarifa: VISTA, control: "La tarifa explica 37 de 41 órdenes de compra pasadas (hasta 1 peso de diferencia por orden)." },
    { comisionista: "Trii", lado: "Venta", tarifa: null, control: "" },
  ],
  historia: [VISTA],
  comisionistas: [{ valor: "TRII", texto: "Trii" }, { valor: "AV", texto: "Acciones & Valores" }],
  lados: [{ valor: "COMPRA", texto: "Compra" }, { valor: "VENTA", texto: "Venta" }],
  tiposCargo: [{ valor: "PCT", texto: "Porcentaje del valor" }, { valor: "FIJO", texto: "Fijo en pesos" }],
  maxCargos: 3,
  guardada: 3,
};

describe("/edicion/tarifas (servidor)", () => {
  beforeEach(() => {
    exigirDueno.mockResolvedValue({ id: "u-dueno", rol: "DUENO" });
    datosEdicionTarifas.mockResolvedValue(DATOS);
  });
  afterEach(() => {
    for (const f of [exigirDueno, datosEdicionTarifas]) f.mockReset();
    vi.restoreAllMocks();
  });
  const consulta = (q: Record<string, string> = {}) => ({ searchParams: Promise.resolve(q) });

  it("la familia (exigirDueno lanza el 404) no llega a leer nada", async () => {
    exigirDueno.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(PaginaTarifas(consulta())).rejects.toThrow("NOT_FOUND");
    expect(datosEdicionTarifas).not.toHaveBeenCalled();
  });

  it("pinta las vigentes con su control, la sin tarifa, la historia con la guardada y el formulario", async () => {
    const raiz = document.createElement("div");
    raiz.innerHTML = renderToStaticMarkup(await PaginaTarifas(consulta({ guardada: "3" })));
    expect(datosEdicionTarifas).toHaveBeenCalledWith({ soy: "la base" }, "3");
    const todo = texto(raiz);
    expect(texto(raiz.querySelector("h1"))).toBe(TEXTOS_TARIFAS.TITULO);
    expect(raiz.querySelector('nav[aria-label="Secciones"] a[aria-current="page"]')?.getAttribute("href")).toBe("/edicion");
    expect(todo).toContain("La tarifa explica 37 de 41 órdenes de compra pasadas");
    expect(todo).toContain(TEXTOS_TARIFAS.SIN_TARIFA);
    expect(todo).toContain(TEXTOS_TARIFAS.FORMULA);
    expect(texto(raiz.querySelector(".tarifa-guardada"))).toContain(TEXTOS_TARIFAS.GUARDADA);
    expect(raiz.querySelector("form")).not.toBeNull();
  });

  it("sin base, el aviso de siempre", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { Prisma } = await import("@prisma/client");
    datosEdicionTarifas.mockRejectedValue(new Prisma.PrismaClientInitializationError("sin base", "5.22.0"));
    const raiz = document.createElement("div");
    raiz.innerHTML = renderToStaticMarkup(await PaginaTarifas(consulta()));
    expect(raiz.querySelector("form")).toBeNull();
  });

  it("la historia vacía lo dice", async () => {
    datosEdicionTarifas.mockResolvedValue({ ...DATOS, historia: [], guardada: null });
    const raiz = document.createElement("div");
    raiz.innerHTML = renderToStaticMarkup(await PaginaTarifas(consulta()));
    expect(texto(raiz)).toContain(TEXTOS_TARIFAS.SIN_HISTORIA);
  });
});

describe("FormularioTarifa (navegador)", () => {
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
  const boton = (nombre: string) => [...m.contenedor.querySelectorAll("button")].find((b) => texto(b).startsWith(nombre)) as HTMLButtonElement | undefined;
  const control = <T extends HTMLElement>(id: string) => m.contenedor.querySelector<T>(`#${id}`)!;
  const responder = async (cuerpo: unknown, estado: number) => {
    await act(async () => { respuestas.shift()!(new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } })); });
  };
  async function cambiar(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, valor: string): Promise<void> {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, valor);
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    });
  }
  const enviar = async () => act(async () => { m.contenedor.querySelector("form")!.requestSubmit(); });

  it("envía lo escrito con la versión de partida y los cargos; con 201 recarga con la guardada", async () => {
    await m.pintar(createElement(FormularioTarifa, { datos: DATOS }));
    await cambiar(control("tarifa-comisionista"), "AV");
    await cambiar(control("tarifa-lado"), "VENTA");
    await cambiar(control("tarifa-porcentaje"), "0,2731");
    await cambiar(control("tarifa-motivo"), "Motivo ficticio");
    await act(async () => boton(TEXTOS_TARIFAS.AGREGAR_CARGO)!.click());
    await cambiar(control("tarifa-otrosCargos-0-nombre"), "Cargo ficticio");
    await cambiar(control("tarifa-otrosCargos-0-valor"), "0,0137");
    await enviar();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFalso.mock.calls[0]!;
    expect(url).toBe("/api/operar/tarifas");
    expect(JSON.parse(String(init.body))).toEqual({
      versionBase: 3, comisionista: "AV", lado: "VENTA", porcentaje: "0,2731", minimoPorOrden: "0", fijoPorOrden: "0", ivaPct: "0", vigenteDesde: "2027-03-17", motivo: "Motivo ficticio",
      otrosCargos: [{ nombre: "Cargo ficticio", tipo: "PCT", valor: "0,0137" }],
    });
    await responder({ version: 4 }, 201);
    expect(ir).toHaveBeenCalledWith("/edicion/tarifas?guardada=4");
  });

  it("con 400 el resumen toma el foco y el campo queda marcado con el mensaje de su código", async () => {
    await m.pintar(createElement(FormularioTarifa, { datos: DATOS }));
    await enviar();
    await responder({ error: "Revise", campos: [{ campo: "porcentaje", codigo: "PORCENTAJE_INVALIDO" }] }, 400);
    expect(document.activeElement).toBe(m.contenedor.querySelector(".edicion-resumen"));
    expect(control("tarifa-porcentaje").getAttribute("aria-invalid")).toBe("true");
    expect(texto(control("tarifa-porcentaje-error"))).toBe(mensajeTarifa("PORCENTAJE_INVALIDO"));
    expect(texto(m.contenedor.querySelector(".edicion-resumen"))).toContain(`Porcentaje sobre el valor (%): ${mensajeTarifa("PORCENTAJE_INVALIDO")}`);
    expect(ir).not.toHaveBeenCalled();
  });

  it("accesibilidad (revisión de React): sin error el resumen no cita un id que no existe; el error de los cargos se enlaza al grupo y se limpia al cambiar los cargos", async () => {
    await m.pintar(createElement(FormularioTarifa, { datos: DATOS }));
    expect(m.contenedor.querySelector(".edicion-resumen")?.hasAttribute("aria-labelledby")).toBe(false);
    await act(async () => boton(TEXTOS_TARIFAS.AGREGAR_CARGO)!.click());
    await enviar();
    await responder({ error: "Revise", campos: [{ campo: "otrosCargos", codigo: "CARGOS_DEMASIADOS" }, { campo: "otrosCargos.0.valor", codigo: "MONTO_INVALIDO" }] }, 400);
    const grupo = m.contenedor.querySelector("fieldset")!;
    expect(grupo.getAttribute("aria-describedby")).toBe("tarifa-otrosCargos");
    expect(texto(document.getElementById("tarifa-otrosCargos"))).toBe(mensajeTarifa("CARGOS_DEMASIADOS"));
    await act(async () => boton(TEXTOS_TARIFAS.QUITAR_CARGO)!.click());
    expect(m.contenedor.querySelector(".edicion-error")).toBeNull();
    expect(m.contenedor.querySelector("fieldset")!.hasAttribute("aria-describedby")).toBe(false);
  });

  it("hasta 3 cargos: el botón de agregar desaparece y se puede quitar uno", async () => {
    await m.pintar(createElement(FormularioTarifa, { datos: DATOS }));
    for (let i = 0; i < 3; i++) await act(async () => boton(TEXTOS_TARIFAS.AGREGAR_CARGO)!.click());
    expect(boton(TEXTOS_TARIFAS.AGREGAR_CARGO)).toBeUndefined();
    await act(async () => boton(TEXTOS_TARIFAS.QUITAR_CARGO)!.click());
    expect(m.contenedor.querySelectorAll(".tarifa-cargo")).toHaveLength(2);
    expect(boton(TEXTOS_TARIFAS.AGREGAR_CARGO)).toBeDefined();
  });
});
