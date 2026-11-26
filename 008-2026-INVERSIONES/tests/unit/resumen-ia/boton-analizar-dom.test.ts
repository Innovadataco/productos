// @vitest-environment jsdom
// El botón «Analizar con IA» en el navegador (solo lo monta la tarjeta cuando el dueño lo puede usar):
//  - manda POST /api/ia/analizar con EXACTAMENTE {"tarea": …} y nada más;
//  - «Analizando…» mientras corre, con sondeo corto del estado, y al terminar refresca la pantalla (router.refresh);
//  - «En espera» si hay otro en curso; mensaje claro si ya hay uno en curso y otro en espera (descartado);
//  - si no se puede aún, dice cuándo (los segundos que faltan, en palabras);
//  - al cargar la página ya refleja un análisis en curso o la espera mínima (sondeo inicial del estado);
//  - los textos no aconsejan ni dicen «008». Datos inventados.
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refrescar = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refrescar }) }));

import { BotonAnalizar, SONDEO_MS } from "@/app/_comun/resumen-ia/BotonAnalizar";
import { TEXTOS_RESUMEN_IA, textoEspera } from "@/app/_comun/resumen-ia/textos";
import { prohibidasEn } from "../operar/informe/lenguaje";
import { montar, texto, type Montaje } from "../graficas/dom";

type Estado = { enCurso: string | null; enEspera: string | null; reintentarEnS: number; ultimo: { tarea: string; estado: string } | null };
const LIBRE: Estado = { enCurso: null, enEspera: null, reintentarEnS: 0, ultimo: null };

let m: Montaje;
let estado: Estado;
let respuestaPedido: { estado: number; cuerpo: unknown };
const llamadas: { url: string; init: RequestInit }[] = [];
const fetchFalso = vi.fn(async (url: string, init: RequestInit = {}) => {
  llamadas.push({ url, init });
  if ((init.method ?? "GET") === "GET") return new Response(JSON.stringify({ estado }), { status: 200 });
  return new Response(JSON.stringify(respuestaPedido.cuerpo), { status: respuestaPedido.estado });
});

beforeEach(() => {
  vi.useFakeTimers();
  estado = { ...LIBRE };
  respuestaPedido = { estado: 202, cuerpo: { estado: "ACEPTADO", lugar: "EN_CURSO" } };
  llamadas.length = 0;
  fetchFalso.mockClear();
  refrescar.mockClear();
  vi.stubGlobal("fetch", fetchFalso);
  m = montar();
});
afterEach(() => {
  m.desmontar();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const boton = () => m.contenedor.querySelector<HTMLButtonElement>("button.resumen-ia-analizar")!;
const mensaje = () => texto(m.contenedor.querySelector(".resumen-ia-analizar-estado"));
const asentar = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
async function montarBoton(tarea = "DIARIO"): Promise<void> {
  await m.pintar(createElement(BotonAnalizar, { tarea: tarea as "DIARIO" }));
  await asentar();
}

describe("BotonAnalizar", () => {
  it("al cargar: el botón con su texto y una sola lectura del estado (GET), sin pedir nada", async () => {
    await montarBoton();
    expect(texto(boton())).toBe("Analizar con IA");
    expect(boton().disabled).toBe(false);
    expect(boton().type).toBe("button");
    expect(llamadas.map((l) => `${l.init.method ?? "GET"} ${l.url}`)).toEqual(["GET /api/ia/analizar"]);
  });

  it("al hacer clic manda POST con exactamente la tarea, y muestra «Analizando…» con el botón deshabilitado", async () => {
    await montarBoton("REGLAS");
    await act(async () => { boton().click(); });
    await asentar();
    const post = llamadas.find((l) => l.init.method === "POST")!;
    expect(post.url).toBe("/api/ia/analizar");
    expect(post.init.body).toBe('{"tarea":"REGLAS"}');
    expect((post.init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(mensaje()).toBe("Analizando…");
    expect(boton().disabled).toBe(true);
    expect(boton().getAttribute("aria-busy")).toBe("true");
    expect(m.contenedor.querySelector(".resumen-ia-analizar-estado")?.getAttribute("role")).toBe("status");
  });

  it("sondea el estado cada poco y, al terminar su tarea, refresca la pantalla y vuelve a quedar libre", async () => {
    await montarBoton();
    estado = { ...LIBRE, enCurso: "DIARIO" };
    await act(async () => { boton().click(); });
    await asentar(SONDEO_MS);
    expect(refrescar).not.toHaveBeenCalled();
    expect(mensaje()).toBe("Analizando…");
    estado = { ...LIBRE, ultimo: { tarea: "DIARIO", estado: "PUBLICADO" }, reintentarEnS: 120 };
    await asentar(SONDEO_MS);
    expect(refrescar).toHaveBeenCalledTimes(1);
    expect(mensaje()).toBe(textoEspera(120));
    expect(boton().disabled).toBe(true);
  });

  it("deja de sondear cuando termina (no queda un reloj girando)", async () => {
    await montarBoton();
    await act(async () => { boton().click(); });
    estado = { ...LIBRE };
    await asentar(SONDEO_MS);
    const antes = llamadas.length;
    await asentar(SONDEO_MS * 5);
    expect(llamadas.length).toBe(antes);
  });

  it("EN_ESPERA: lo dice, y sigue sondeando hasta que corra y termine", async () => {
    respuestaPedido = { estado: 202, cuerpo: { estado: "ACEPTADO", lugar: "EN_ESPERA" } };
    await montarBoton();
    estado = { ...LIBRE, enCurso: "REGLAS", enEspera: "DIARIO" };
    await act(async () => { boton().click(); });
    await asentar();
    expect(mensaje()).toBe(TEXTOS_RESUMEN_IA.boton.enEspera);
    expect(boton().disabled).toBe(true);
    await asentar(SONDEO_MS);
    expect(refrescar).not.toHaveBeenCalled();
  });

  it("OCUPADO (uno en curso y otro en espera): el clic se descarta con un mensaje claro y el botón sigue disponible", async () => {
    respuestaPedido = { estado: 429, cuerpo: { codigo: "OCUPADO" } };
    await montarBoton();
    await act(async () => { boton().click(); });
    await asentar();
    expect(mensaje()).toBe(TEXTOS_RESUMEN_IA.boton.ocupado);
    expect(boton().disabled).toBe(false);
    expect(refrescar).not.toHaveBeenCalled();
  });

  it("ESPERA_MINIMA: dice cuándo se puede, en palabras y con los segundos que faltan", async () => {
    respuestaPedido = { estado: 429, cuerpo: { codigo: "ESPERA_MINIMA", reintentarEnS: 75 } };
    await montarBoton();
    await act(async () => { boton().click(); });
    await asentar();
    expect(mensaje()).toBe("Puede volver a analizar en 1 min 15 s.");
    expect(boton().disabled).toBe(true);
    await asentar(76_000);
    expect(boton().disabled).toBe(false);
  });

  it.each([
    [0, "Puede volver a analizar ya."], [1, "Puede volver a analizar en 1 s."], [59, "Puede volver a analizar en 59 s."], [60, "Puede volver a analizar en 1 min."],
    [120, "Puede volver a analizar en 2 min."], [121, "Puede volver a analizar en 2 min 1 s."],
  ])("textoEspera(%i)", (s, esperado) => {
    expect(textoEspera(s)).toBe(esperado);
  });

  it.each([
    [403, { codigo: "ANALISIS_APAGADO" }, "apagado"], [409, { codigo: "TAREA_INACTIVA" }, "tareaInactiva"], [503, { codigo: "SERVICIO_NO_DISPONIBLE" }, "sinServicio"],
    [502, { codigo: "RESPUESTA_INVALIDA" }, "sinServicio"], [429, { error: "Demasiadas solicitudes" }, "demasiado"], [500, { error: "x" }, "error"],
  ])("el estado %i (%j) se dice con su texto fijo, nunca con el del servidor", async (codigoHttp, cuerpo, clave) => {
    respuestaPedido = { estado: codigoHttp, cuerpo };
    await montarBoton();
    await act(async () => { boton().click(); });
    await asentar();
    expect(mensaje()).toBe(TEXTOS_RESUMEN_IA.boton[clave as "apagado"]);
    expect(boton().disabled).toBe(false);
  });

  it("si la red falla al pedir: mensaje de error y el botón sigue disponible", async () => {
    await montarBoton();
    fetchFalso.mockRejectedValueOnce(new TypeError("fetch failed 4613"));
    await act(async () => { boton().click(); });
    await asentar();
    expect(mensaje()).toBe(TEXTOS_RESUMEN_IA.boton.error);
    expect(boton().disabled).toBe(false);
    expect(texto(m.contenedor)).not.toContain("4613");
  });

  it("recargar la página con un análisis ya en curso de esa tarea: arranca en «Analizando…» sin hacer clic", async () => {
    estado = { ...LIBRE, enCurso: "DIARIO" };
    await montarBoton("DIARIO");
    expect(mensaje()).toBe("Analizando…");
    expect(boton().disabled).toBe(true);
  });

  it("con la espera mínima vigente al cargar: deshabilitado y dice cuándo", async () => {
    estado = { ...LIBRE, reintentarEnS: 90 };
    await montarBoton();
    expect(mensaje()).toBe("Puede volver a analizar en 1 min 30 s.");
    expect(boton().disabled).toBe(true);
  });

  it("un análisis en curso de OTRA tarea no marca este botón como analizando", async () => {
    estado = { ...LIBRE, enCurso: "REGLAS" };
    await montarBoton("DIARIO");
    expect(mensaje()).toBe("");
    expect(boton().disabled).toBe(false);
  });

  it("si el estado no se puede leer (servicio caído): el botón queda disponible, sin mensaje alarmante", async () => {
    fetchFalso.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    await montarBoton();
    expect(boton().disabled).toBe(false);
    expect(mensaje()).toBe("");
  });

  it("los textos fijos del botón: sin lenguaje de consejo (con control positivo), sin «008» y sin códigos", () => {
    const fijos = JSON.stringify(TEXTOS_RESUMEN_IA.boton) + textoEspera(75);
    expect(prohibidasEn(fijos)).toEqual([]);
    expect(prohibidasEn("Le recomendamos vender ya")).not.toEqual([]);
    expect(fijos).not.toMatch(/\b008\b/);
    expect(fijos).not.toMatch(/\b[A-Z]{3,}_[A-Z_]+\b/);
  });
});
