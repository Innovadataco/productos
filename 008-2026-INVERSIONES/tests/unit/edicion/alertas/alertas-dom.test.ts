// @vitest-environment jsdom
// /edicion/alertas en el navegador y en el servidor:
//  - la página exige al dueño ANTES de leer (la familia, 404 sin leer nada) y pinta el formulario con los valores vigentes (o la
//    omisión), la historia (con la recién guardada marcada) y el aviso de que informa y no recomienda; sin base, el aviso de siempre;
//  - el formulario envía lo escrito (con la última versión que vio) a POST /api/alertas/umbrales; con 201 recarga con la versión
//    guardada; con 400 el resumen toma el foco y el campo queda marcado; con 409 lo dice.
//  - ningún texto recomienda comprar ni vender (prohibidasEn, con su control positivo).
// Datos inventados.
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosEdicionAlertas } from "@/app/edicion/alertas/tipos-alertas";
import { prohibidasEn } from "../../operar/informe/lenguaje";
import { montar, texto, type Montaje } from "../../graficas/dom";

const ir = vi.hoisted(() => vi.fn());
const exigirDueno = vi.hoisted(() => vi.fn());
const datosEdicionAlertas = vi.hoisted(() => vi.fn());
vi.mock("@/app/edicion/enviar", async (original) => ({ ...(await original<typeof import("@/app/edicion/enviar")>()), irA: ir }));
vi.mock("@/auth/sesion", () => ({ exigirDueno }));
vi.mock("@/lib/db", () => ({ db: { soy: "la base" } }));
vi.mock("@/app/edicion/alertas/datos", () => ({ datosEdicionAlertas }));

import PaginaAlertas from "@/app/edicion/alertas/page";
import { FormularioAlertas } from "@/app/edicion/alertas/FormularioAlertas";
import { ETIQUETAS_ALERTAS, LEYENDAS_ALERTAS, TEXTOS_ALERTAS, mensajeAlertas } from "@/app/edicion/alertas/textos-alertas";

const DATOS: DatosEdicionAlertas = {
  ultimaVersion: 2,
  porOmision: false,
  valores: {
    alertaCercaPct: "3,5", alertaCercaActiva: true, alertaNivelCruzadoActiva: true, alertaMovimientoPct: "4", alertaMovimientoActiva: false,
    alertaCaidaPct: "2,25", alertaCaidaActiva: true, alertaDatoViejoMin: "45", alertaDatoViejoActiva: true, alertaExDiasHabiles: "5", alertaExActiva: true,
  },
  historia: [{ version: 2, creada: "11-ene-2027 18:41", motivo: "motivo ficticio", resumen: "Cerca 3,5 % · Movimiento 4 % (apagada) · Caída 2,25 % · Dato viejo 45 min · Fecha ex 5 días hábiles" }],
  guardada: 2,
};

describe("/edicion/alertas (servidor)", () => {
  beforeEach(() => {
    exigirDueno.mockResolvedValue({ id: "u-dueno", rol: "DUENO" });
    datosEdicionAlertas.mockResolvedValue(DATOS);
  });
  afterEach(() => {
    for (const f of [exigirDueno, datosEdicionAlertas]) f.mockReset();
    vi.restoreAllMocks();
  });
  const consulta = (q: Record<string, string> = {}) => ({ searchParams: Promise.resolve(q) });

  it("la familia (exigirDueno lanza el 404) no llega a leer nada", async () => {
    exigirDueno.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(PaginaAlertas(consulta())).rejects.toThrow("NOT_FOUND");
    expect(datosEdicionAlertas).not.toHaveBeenCalled();
  });

  it("pinta el formulario con lo vigente, la historia con la guardada y el aviso; «Configuración» queda marcada", async () => {
    const raiz = document.createElement("div");
    raiz.innerHTML = renderToStaticMarkup(await PaginaAlertas(consulta({ guardada: "2" })));
    expect(datosEdicionAlertas).toHaveBeenCalledWith({ soy: "la base" }, "2");
    expect(texto(raiz.querySelector("h1"))).toBe(TEXTOS_ALERTAS.TITULO);
    expect(raiz.querySelector('nav[aria-label="Secciones"] a[aria-current="page"]')?.getAttribute("href")).toBe("/edicion");
    expect((raiz.querySelector("#alertas-alertaCercaPct") as HTMLInputElement).getAttribute("value")).toBe("3,5");
    expect((raiz.querySelector("#alertas-alertaMovimientoActiva") as HTMLInputElement).hasAttribute("checked")).toBe(false);
    expect((raiz.querySelector("#alertas-alertaCaidaActiva") as HTMLInputElement).hasAttribute("checked")).toBe(true);
    expect(texto(raiz.querySelector(".alertas-guardada"))).toContain(TEXTOS_ALERTAS.GUARDADA);
    expect(texto(raiz)).toContain(TEXTOS_ALERTAS.INTRO);
    expect(texto(raiz)).toContain("motivo ficticio");
  });

  it("sin versiones dice que rigen las omisiones; sin base, el aviso de siempre", async () => {
    datosEdicionAlertas.mockResolvedValue({ ...DATOS, ultimaVersion: 0, porOmision: true, historia: [], guardada: null });
    const raiz = document.createElement("div");
    raiz.innerHTML = renderToStaticMarkup(await PaginaAlertas(consulta()));
    expect(texto(raiz)).toContain(TEXTOS_ALERTAS.POR_OMISION);
    expect(texto(raiz)).toContain(TEXTOS_ALERTAS.SIN_HISTORIA);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { Prisma } = await import("@prisma/client");
    datosEdicionAlertas.mockRejectedValue(new Prisma.PrismaClientInitializationError("sin base", "5.22.0"));
    const sin = document.createElement("div");
    sin.innerHTML = renderToStaticMarkup(await PaginaAlertas(consulta()));
    expect(sin.querySelector("form")).toBeNull();
  });

  it("ningún texto recomienda comprar ni vender (con control positivo del detector)", async () => {
    const raiz = document.createElement("div");
    raiz.innerHTML = renderToStaticMarkup(await PaginaAlertas(consulta()));
    expect(prohibidasEn(texto(raiz))).toEqual([]);
    expect(prohibidasEn("Le recomendamos que venda hoy")).not.toEqual([]);
  });
});

describe("FormularioAlertas (navegador)", () => {
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
  const control = <T extends HTMLElement>(id: string) => m.contenedor.querySelector<T>(`#${id}`)!;
  const responder = async (cuerpo: unknown, estado: number) => {
    await act(async () => { respuestas.shift()!(new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } })); });
  };
  async function escribir(el: HTMLInputElement | HTMLTextAreaElement, valor: string): Promise<void> {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, valor);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  const enviar = async () => act(async () => { m.contenedor.querySelector("form")!.requestSubmit(); });

  it("cada interruptor y cada umbral tiene su etiqueta y su valor vigente", async () => {
    await m.pintar(createElement(FormularioAlertas, { datos: DATOS }));
    for (const campo of Object.keys(DATOS.valores)) {
      const el = control<HTMLInputElement>(`alertas-${campo}`);
      expect(el, campo).not.toBeNull();
      expect(texto(m.contenedor.querySelector(`label[for="alertas-${campo}"]`)), campo).toBe(ETIQUETAS_ALERTAS[campo as keyof typeof ETIQUETAS_ALERTAS]);
    }
    expect(control<HTMLInputElement>("alertas-alertaDatoViejoMin").value).toBe("45");
    expect(control<HTMLInputElement>("alertas-alertaMovimientoActiva").checked).toBe(false);
  });

  it("cada alerta es un grupo con su leyenda (fieldset y legend con el nombre de la alerta) y las casillas miden 24 px", async () => {
    await m.pintar(createElement(FormularioAlertas, { datos: DATOS }));
    const leyendas = [...m.contenedor.querySelectorAll("fieldset > legend")].map((l) => texto(l));
    expect(leyendas).toEqual(Object.values(LEYENDAS_ALERTAS));
    expect(leyendas).toHaveLength(6);
    expect(m.contenedor.querySelectorAll("fieldset").length).toBe(6);
  });

  it("el resumen de errores es el común del área (región con nombre y enlaces a cada campo)", async () => {
    await m.pintar(createElement(FormularioAlertas, { datos: DATOS }));
    await enviar();
    await responder({ error: "Revise", codigo: "DATOS_INVALIDOS", campos: [{ campo: "alertaCercaPct", codigo: "FUERA_DE_RANGO" }] }, 400);
    const resumen = m.contenedor.querySelector(".edicion-resumen")!;
    expect(resumen.getAttribute("aria-labelledby")).toBe("edicion-resumen-titulo");
    expect(document.getElementById("edicion-resumen-titulo")).not.toBeNull();
    expect(resumen.querySelector("a")?.getAttribute("href")).toBe("#alertas-alertaCercaPct");
  });

  it("envía lo escrito con la versión de partida; con 201 recarga con la guardada", async () => {
    await m.pintar(createElement(FormularioAlertas, { datos: DATOS }));
    await escribir(control("alertas-alertaCercaPct"), "5,5");
    await act(async () => control<HTMLInputElement>("alertas-alertaMovimientoActiva").click());
    await escribir(control("alertas-motivo"), "Motivo ficticio");
    await enviar();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFalso.mock.calls[0]!;
    expect(url).toBe("/api/alertas/umbrales");
    expect(JSON.parse(String(init.body))).toEqual({
      versionBase: 2, alertaCercaPct: "5,5", alertaCercaActiva: true, alertaNivelCruzadoActiva: true, alertaMovimientoPct: "4", alertaMovimientoActiva: true,
      alertaCaidaPct: "2,25", alertaCaidaActiva: true, alertaDatoViejoMin: "45", alertaDatoViejoActiva: true, alertaExDiasHabiles: "5", alertaExActiva: true, motivo: "Motivo ficticio",
    });
    await responder({ version: 3 }, 201);
    expect(ir).toHaveBeenCalledWith("/edicion/alertas?guardada=3");
  });

  it("con 400 el resumen toma el foco y el campo queda marcado con el mensaje de su código", async () => {
    await m.pintar(createElement(FormularioAlertas, { datos: DATOS }));
    await enviar();
    await responder({ error: "Revise", codigo: "DATOS_INVALIDOS", campos: [{ campo: "alertaCercaPct", codigo: "FUERA_DE_RANGO" }] }, 400);
    expect(document.activeElement).toBe(m.contenedor.querySelector(".edicion-resumen"));
    expect(control("alertas-alertaCercaPct").getAttribute("aria-invalid")).toBe("true");
    expect(texto(control("alertas-alertaCercaPct-error"))).toBe(mensajeAlertas("FUERA_DE_RANGO"));
    expect(texto(m.contenedor.querySelector(".edicion-resumen"))).toContain(`${ETIQUETAS_ALERTAS.alertaCercaPct}: ${mensajeAlertas("FUERA_DE_RANGO")}`);
    expect(ir).not.toHaveBeenCalled();
  });

  it("con 409 dice que se guardó otra versión mientras editaba y no navega", async () => {
    await m.pintar(createElement(FormularioAlertas, { datos: DATOS }));
    await enviar();
    await responder({ error: "cambió", campos: [{ campo: "versionBase", codigo: "UMBRAL_CAMBIO" }] }, 409);
    expect(texto(m.contenedor.querySelector(".edicion-resumen"))).toContain(mensajeAlertas("UMBRAL_CAMBIO"));
    expect(ir).not.toHaveBeenCalled();
  });

  it("un solo envío a la vez: dos clics seguidos mandan un pedido", async () => {
    await m.pintar(createElement(FormularioAlertas, { datos: DATOS }));
    await enviar();
    await enviar();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });
});
