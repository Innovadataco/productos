// @vitest-environment jsdom
// La página /alertas con los datos simulados: exige la sesión ANTES de leer; el dueño ve «Marcar vista» en cada alerta sin
// marcar y «Marcar todas»; la familia la ve en solo lectura (sin botones ni formularios); agrupa por día con el texto de
// textoDeAlerta y la procedencia (FechaDato) de cada dato; «Alertas» es la pantalla actual; con la base caída, el aviso de
// siempre; ningún texto recomienda comprar ni vender. Inventado.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VistaAlertas } from "@/app/alertas/vista";
import { prohibidasEn } from "../operar/informe/lenguaje";

const exigirSesion = vi.hoisted(() => vi.fn());
const datosDeAlertas = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/auth/sesion", () => ({ exigirSesion }));
vi.mock("@/lib/db", () => ({ db: { soy: "la base" } }));
vi.mock("@/app/alertas/datos", () => ({ datosDeAlertas }));

import PaginaAlertas from "@/app/alertas/page";
import { TEXTOS_ALERTAS_PANTALLA } from "@/app/alertas/textos";

const VISTA: VistaAlertas = {
  total: 3,
  sinVer: 2,
  dias: [
    {
      dia: "2026-11-25",
      titulo: "25-nov-2026",
      alertas: [
        { id: "a-1", tipo: "MOVIMIENTO_DIA", texto: "FICTICIA-A: cierre del día (90) está 10 % por debajo del cierre anterior.", procedencia: { dia: "2026-11-25", traidoEn: "2026-11-25 18:20", fuente: "yahoo", tipo: "CIERRE" }, vista: null },
        { id: "a-2", tipo: "FECHA_EX", texto: "FICTICIA-A: la fecha ex del decreto es el 2026-11-26.", procedencia: null, vista: null },
      ],
    },
    {
      dia: "2026-11-20",
      titulo: "20-nov-2026",
      alertas: [{ id: "a-3", tipo: "DATO_VIEJO", texto: "FICTICIA-B: falta el cierre de hoy.", procedencia: null, vista: "20-nov-2026 18:45" }],
    },
  ],
};
const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
async function pantalla(): Promise<HTMLElement> {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(await PaginaAlertas());
  return raiz;
}

beforeEach(() => {
  exigirSesion.mockResolvedValue({ id: "u-4613", email: "dueno@ejemplo.invalid", rol: "DUENO" });
  datosDeAlertas.mockResolvedValue(VISTA);
});
afterEach(() => {
  vi.restoreAllMocks();
  exigirSesion.mockReset();
  datosDeAlertas.mockReset();
});

describe("src/app/alertas/page.tsx", () => {
  it("exige la sesión y después lee con la base del proceso y el día de Colombia", async () => {
    const orden: string[] = [];
    exigirSesion.mockImplementationOnce(async () => { orden.push("sesion"); return { id: "u", rol: "DUENO" }; });
    datosDeAlertas.mockImplementationOnce(async () => { orden.push("datos"); return VISTA; });
    await PaginaAlertas();
    expect(orden).toEqual(["sesion", "datos"]);
    expect(datosDeAlertas.mock.calls[0]![0]).toEqual({ soy: "la base" });
    expect((datosDeAlertas.mock.calls[0]![1] as Date).getUTCHours()).toBe(0);
  });

  it("agrupa por día (un h2 por día), con el texto de cada alerta y su procedencia, e «Alertas» como pantalla actual", async () => {
    const raiz = await pantalla();
    expect(texto(raiz.querySelector("h1"))).toBe(TEXTOS_ALERTAS_PANTALLA.TITULO);
    expect([...raiz.querySelectorAll("main h2")].map((h) => texto(h))).toEqual(["25-nov-2026", "20-nov-2026"]);
    const items = [...raiz.querySelectorAll("main li.alerta")];
    expect(items).toHaveLength(3);
    expect(texto(items[0]!.querySelector(".alerta-texto"))).toBe(VISTA.dias[0]!.alertas[0]!.texto);
    expect(texto(items[0]!.querySelector(".fecha-dato"))).toBe("Cierre 25-nov · Yahoo (BVC) · traído 18:20");
    expect(items[1]!.querySelector(".fecha-dato")).toBeNull();
    expect(texto(items[2]!)).toContain("Vista el 20-nov-2026 18:45");
    expect([...raiz.querySelectorAll('header nav[aria-label="Secciones"] a[aria-current="page"]')].map((a) => a.getAttribute("href"))).toEqual(["/alertas"]);
  });

  it("el dueño ve «Marcar vista» solo en las que faltan y «Marcar todas»; el aviso de lo que falta", async () => {
    const raiz = await pantalla();
    const botones = [...raiz.querySelectorAll("main button")].map((b) => texto(b));
    expect(botones.filter((b) => b === TEXTOS_ALERTAS_PANTALLA.MARCAR)).toHaveLength(2);
    expect(botones).toContain(TEXTOS_ALERTAS_PANTALLA.MARCAR_TODAS);
    expect(texto(raiz.querySelector("main"))).toContain("2 sin marcar");
    expect(raiz.querySelector('main a[href="/edicion/alertas"]')).not.toBeNull();
    expect(raiz.querySelector('header .marca-solo-lectura, header [data-solo-lectura]')).toBeNull();
  });

  it("cada «Marcar como vista» dice de cuál alerta es (tipo y día) y empieza por su texto visible", async () => {
    const raiz = await pantalla();
    const nombres = [...raiz.querySelectorAll("main li.alerta button")].map((b) => b.getAttribute("aria-label"));
    expect(nombres).toEqual(["Marcar como vista: Movimiento del día del 25-nov-2026", "Marcar como vista: Fecha ex del 25-nov-2026"]);
    for (const n of nombres) expect(n!.startsWith(TEXTOS_ALERTAS_PANTALLA.MARCAR)).toBe(true);
    expect(raiz.querySelector("h1")?.getAttribute("tabindex")).toBe("-1");
  });

  it("la familia ve «Sin marcar» en las no vistas (y nada en las vistas)", async () => {
    exigirSesion.mockResolvedValue({ id: "u-379", email: "familia@ejemplo.invalid", rol: "FAMILIA" });
    const raiz = await pantalla();
    const items = [...raiz.querySelectorAll("main li.alerta")];
    expect(items.map((i) => texto(i.querySelector(".alerta-estado")))).toEqual([TEXTOS_ALERTAS_PANTALLA.SIN_MARCAR, TEXTOS_ALERTAS_PANTALLA.SIN_MARCAR, ""]);
  });

  it("la familia la ve en solo lectura: sin botones, sin formularios y sin el enlace a configurar", async () => {
    exigirSesion.mockResolvedValue({ id: "u-379", email: "familia@ejemplo.invalid", rol: "FAMILIA" });
    const raiz = await pantalla();
    expect(raiz.querySelectorAll("main button, main form, main input")).toHaveLength(0);
    expect(raiz.querySelector('main a[href="/edicion/alertas"]')).toBeNull();
    expect(texto(raiz)).toContain("Solo lectura");
    expect(raiz.querySelectorAll("main li.alerta")).toHaveLength(3);
  });

  it("sin alertas lo dice y no ofrece «Marcar todas»", async () => {
    datosDeAlertas.mockResolvedValue({ dias: [], sinVer: 0, total: 0 });
    const raiz = await pantalla();
    expect(texto(raiz.querySelector("main"))).toContain(TEXTOS_ALERTAS_PANTALLA.SIN_ALERTAS);
    expect(raiz.querySelectorAll("main button")).toHaveLength(0);
  });

  it("con todas marcadas no ofrece «Marcar todas»", async () => {
    datosDeAlertas.mockResolvedValue({ ...VISTA, sinVer: 0, dias: [{ ...VISTA.dias[1]! }] });
    const raiz = await pantalla();
    expect([...raiz.querySelectorAll("main button")].map((b) => texto(b))).toEqual([]);
  });

  it("con la base caída muestra el aviso de siempre", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { Prisma } = await import("@prisma/client");
    datosDeAlertas.mockRejectedValue(new Prisma.PrismaClientInitializationError("sin base", "5.22.0"));
    const raiz = await pantalla();
    expect(raiz.querySelector("main li.alerta")).toBeNull();
  });

  it("otro error se propaga", async () => {
    datosDeAlertas.mockRejectedValue(new Error("otro"));
    await expect(PaginaAlertas()).rejects.toThrow("otro");
  });

  it("la etiqueta de la especie, que es de terceros, no inyecta HTML: va escapada y entre « » (con <img> hostil)", async () => {
    const { construirVista } = await import("@/app/alertas/vista");
    const { Prisma } = await import("@prisma/client");
    const hostil = '<img src=x onerror="alert(1)"> Compre ya';
    datosDeAlertas.mockResolvedValue(construirVista([{
      id: "x-1", dia: new Date("2026-11-25T00:00:00Z"), tipo: "MOVIMIENTO_DIA", nemotecnico: hostil, fechaExDecreto: null, fechaPagoDecreto: null, sentido: "BAJO", base: "CIERRE",
      precio: new Prisma.Decimal("90"), referencia: null, variacionPct: new Prisma.Decimal("-10"), umbral: null, instanteDato: null, traidoEn: null, fuente: null, conRetraso: null, minutosDeEdad: null, esFechaEx: false, vistaEn: null,
    }]));
    const raiz = await pantalla();
    expect(raiz.querySelector("main img")).toBeNull();
    const t = texto(raiz.querySelector(".alerta-texto"));
    expect(t.startsWith("«img src=x onerror=\"alert(1)\" Compre ya»: ")).toBe(true);
    expect(raiz.innerHTML).not.toContain("<img");
  });

  it("ningún texto de la pantalla recomienda comprar ni vender (con control positivo)", async () => {
    const raiz = await pantalla();
    expect(prohibidasEn(texto(raiz.querySelector("main")))).toEqual([]);
    expect(prohibidasEn("Es buen momento: compre ya")).not.toEqual([]);
  });
});
