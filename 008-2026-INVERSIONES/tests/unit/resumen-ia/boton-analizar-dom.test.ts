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
const servicioFalso = async (url: string, init: RequestInit = {}): Promise<Response> => {
  llamadas.push({ url, init });
  if ((init.method ?? "GET") === "GET") return new Response(JSON.stringify({ estado }), { status: 200 });
  return new Response(JSON.stringify(respuestaPedido.cuerpo), { status: respuestaPedido.estado });
};
const fetchFalso = vi.fn(servicioFalso);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  estado = { ...LIBRE };
  respuestaPedido = { estado: 202, cuerpo: { estado: "ACEPTADO", lugar: "EN_CURSO" } };
  llamadas.length = 0;
  fetchFalso.mockReset();
  fetchFalso.mockImplementation(servicioFalso);
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
const deshabilitado = () => boton().getAttribute("aria-disabled") === "true";
const mensaje = () => texto(m.contenedor.querySelector(".resumen-ia-analizar-estado"));
// Los relojes son falsos, pero la lectura del cuerpo de una Response usa macrotareas reales: se dejan pasar antes y después.
const macrotarea = () => new Promise<void>((r) => setImmediate(r));
const asentar = async (ms = 50) => {
  await act(async () => { await macrotarea(); await vi.advanceTimersByTimeAsync(ms); await macrotarea(); await macrotarea(); });
};
async function montarBoton(tarea = "DIARIO"): Promise<void> {
  await m.pintar(createElement(BotonAnalizar, { tarea: tarea as "DIARIO" }));
  await asentar();
}

describe("BotonAnalizar", () => {
  it("al cargar: el botón con su texto y una sola lectura del estado (GET), sin pedir nada", async () => {
    await montarBoton();
    expect(texto(boton())).toBe("Analizar con IA");
    expect(deshabilitado()).toBe(false);
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
    expect(deshabilitado()).toBe(true);
    expect(boton().hasAttribute("disabled")).toBe(false); // sigue enfocable: no pierde el foco
    // La región viva (role=status) no va dentro de un contenedor aria-busy: el lector no anunciaría los cambios.
    expect(m.contenedor.querySelector("[aria-busy]")).toBeNull();
    expect(m.contenedor.querySelector(".resumen-ia-analizar-estado")?.getAttribute("role")).toBe("status");
  });

  it("un segundo clic mientras analiza no manda otro pedido (el botón sigue enfocable pero se ignora)", async () => {
    await montarBoton();
    await act(async () => { boton().click(); });
    await asentar();
    await act(async () => { boton().click(); });
    await asentar();
    expect(llamadas.filter((l) => l.init.method === "POST")).toHaveLength(1);
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
    expect(mensaje()).toBe(`Análisis listo. ${textoEspera(120)}`);
    expect(deshabilitado()).toBe(true);
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
    expect(deshabilitado()).toBe(true);
    await asentar(SONDEO_MS);
    expect(refrescar).not.toHaveBeenCalled();
  });

  it("OCUPADO (uno en curso y otro en espera): el clic se descarta con un mensaje claro y el botón sigue disponible", async () => {
    respuestaPedido = { estado: 429, cuerpo: { codigo: "OCUPADO" } };
    await montarBoton();
    await act(async () => { boton().click(); });
    await asentar();
    expect(mensaje()).toBe(TEXTOS_RESUMEN_IA.boton.ocupado);
    expect(deshabilitado()).toBe(false);
    expect(refrescar).not.toHaveBeenCalled();
  });

  it("ESPERA_MINIMA: dice cuándo se puede, en palabras y con los segundos que faltan", async () => {
    respuestaPedido = { estado: 429, cuerpo: { codigo: "ESPERA_MINIMA", reintentarEnS: 75 } };
    await montarBoton();
    await act(async () => { boton().click(); });
    await asentar();
    expect(mensaje()).toBe("Puede volver a analizar en 1 min 15 s.");
    expect(deshabilitado()).toBe(true);
    await asentar(76_000);
    expect(deshabilitado()).toBe(false);
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
    expect(deshabilitado()).toBe(false);
  });

  it("si la red falla al pedir: mensaje de error y el botón sigue disponible", async () => {
    await montarBoton();
    fetchFalso.mockRejectedValueOnce(new TypeError("fetch failed 4613"));
    await act(async () => { boton().click(); });
    await asentar();
    expect(mensaje()).toBe(TEXTOS_RESUMEN_IA.boton.error);
    expect(deshabilitado()).toBe(false);
    expect(texto(m.contenedor)).not.toContain("4613");
  });

  it("recargar la página con un análisis ya en curso de esa tarea: arranca en «Analizando…» sin hacer clic", async () => {
    estado = { ...LIBRE, enCurso: "DIARIO" };
    await montarBoton("DIARIO");
    expect(mensaje()).toBe("Analizando…");
    expect(deshabilitado()).toBe(true);
  });

  it("con la espera mínima vigente al cargar: deshabilitado y dice cuándo", async () => {
    estado = { ...LIBRE, reintentarEnS: 90 };
    await montarBoton();
    expect(mensaje()).toBe("Puede volver a analizar en 1 min 30 s.");
    expect(deshabilitado()).toBe(true);
  });

  it("un análisis en curso de OTRA tarea no marca este botón como analizando", async () => {
    estado = { ...LIBRE, enCurso: "REGLAS" };
    await montarBoton("DIARIO");
    expect(mensaje()).toBe("");
    expect(deshabilitado()).toBe(false);
  });

  it("si el estado no se puede leer (servicio caído): el botón queda disponible, sin mensaje alarmante", async () => {
    fetchFalso.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    await montarBoton();
    expect(deshabilitado()).toBe(false);
    expect(mensaje()).toBe("");
  });

  describe("sondeo que falla mientras se muestra «Analizando…»", () => {
    const sinEstado = "No se pudo consultar el estado del análisis; intente de nuevo.";
    const fallar = (como: "rechaza" | "503") => {
      fetchFalso.mockImplementation(async (url: string, init: RequestInit = {}) => {
        llamadas.push({ url, init });
        if ((init.method ?? "GET") === "GET") {
          if (como === "rechaza") throw new TypeError("fetch failed 4613");
          return new Response("{}", { status: 503 });
        }
        return new Response(JSON.stringify(respuestaPedido.cuerpo), { status: respuestaPedido.estado });
      });
    };

    it.each(["rechaza", "503"] as const)("a las 2 fallas seguidas (%s): texto fijo, botón habilitado y estado libre", async (como) => {
      await montarBoton();
      await act(async () => { boton().click(); });
      await asentar();
      expect(mensaje()).toBe("Analizando…");
      fallar(como);
      await asentar(SONDEO_MS);
      expect(mensaje()).toBe("Analizando…"); // una sola falla todavía no avisa
      await asentar(SONDEO_MS);
      expect(mensaje()).toBe(sinEstado);
      expect(mensaje()).toBe(TEXTOS_RESUMEN_IA.boton.sinEstado);
      expect(deshabilitado()).toBe(false);
      expect(texto(m.contenedor)).not.toContain("4613");
      const antes = llamadas.length;
      await asentar(SONDEO_MS * 3); // ya no sondea
      expect(llamadas.length).toBe(antes);
    });

    it("una lectura buena entre dos fallas reinicia la cuenta (no son seguidas)", async () => {
      await montarBoton();
      estado = { ...LIBRE, enCurso: "DIARIO" };
      await act(async () => { boton().click(); });
      await asentar();
      fetchFalso.mockRejectedValueOnce(new TypeError("x"));
      await asentar(SONDEO_MS);
      await asentar(SONDEO_MS); // buena
      fetchFalso.mockRejectedValueOnce(new TypeError("x"));
      await asentar(SONDEO_MS);
      expect(mensaje()).toBe("Analizando…");
      expect(deshabilitado()).toBe(true);
    });
  });

  describe("el último análisis terminó mal (ultimo del estado)", () => {
    const error = "El análisis no se pudo completar. Inténtelo de nuevo.";
    const descartado = "El análisis en espera no se hizo: la IA se apagó mientras esperaba.";
    async function conAnalisisEnCurso(): Promise<void> {
      await montarBoton();
      estado = { ...LIBRE, enCurso: "DIARIO" };
      await act(async () => { boton().click(); });
      await asentar(SONDEO_MS);
    }

    it("ERROR de esta tarea: texto fijo (sin códigos), refresca y el botón queda libre", async () => {
      await conAnalisisEnCurso();
      estado = { ...LIBRE, ultimo: { tarea: "DIARIO", estado: "ERROR" } };
      await asentar(SONDEO_MS);
      expect(mensaje()).toBe(error);
      expect(mensaje()).toBe(TEXTOS_RESUMEN_IA.boton.analisisError);
      expect(deshabilitado()).toBe(false);
      expect(refrescar).toHaveBeenCalledTimes(1);
    });

    it("DESCARTADO de esta tarea: texto fijo", async () => {
      await conAnalisisEnCurso();
      estado = { ...LIBRE, ultimo: { tarea: "DIARIO", estado: "DESCARTADO" } };
      await asentar(SONDEO_MS);
      expect(mensaje()).toBe(descartado);
      expect(mensaje()).toBe(TEXTOS_RESUMEN_IA.boton.analisisDescartado);
    });

    it("con la espera mínima vigente: el texto del fallo y, a continuación, cuándo se puede volver a pedir", async () => {
      await conAnalisisEnCurso();
      estado = { ...LIBRE, reintentarEnS: 120, ultimo: { tarea: "DIARIO", estado: "ERROR" } };
      await asentar(SONDEO_MS);
      expect(mensaje()).toBe(`${error} ${textoEspera(120)}`);
      expect(deshabilitado()).toBe(true);
    });

    it("el ERROR de OTRA tarea no se dice en este botón", async () => {
      await conAnalisisEnCurso();
      estado = { ...LIBRE, ultimo: { tarea: "REGLAS", estado: "ERROR" } };
      await asentar(SONDEO_MS);
      expect(mensaje()).toBe("");
    });

    it("un ERROR viejo que ya estaba al cargar la página no se dice (no hubo un pedido nuestro)", async () => {
      estado = { ...LIBRE, ultimo: { tarea: "DIARIO", estado: "ERROR" } };
      await montarBoton("DIARIO");
      expect(mensaje()).toBe("");
      expect(deshabilitado()).toBe(false);
    });

    it("un análisis que terminó bien (PUBLICADO) dice «Análisis listo.», sin nada de fallo", async () => {
      await conAnalisisEnCurso();
      estado = { ...LIBRE, ultimo: { tarea: "DIARIO", estado: "PUBLICADO" } };
      await asentar(SONDEO_MS);
      expect(mensaje()).toBe("Análisis listo.");
      expect(mensaje()).toBe(TEXTOS_RESUMEN_IA.boton.listo);
      expect(refrescar).toHaveBeenCalledTimes(1);
    });

    it("un estado sin `ultimo` (servicio anterior) sigue valiendo; uno con `ultimo` mal formado cuenta como lectura fallida", async () => {
      await conAnalisisEnCurso();
      const { ultimo: _sin, ...sinUltimo } = LIBRE;
      estado = sinUltimo as Estado;
      await asentar(SONDEO_MS);
      expect(refrescar).toHaveBeenCalledTimes(1);
      expect(mensaje()).toBe("");
      estado = { ...LIBRE, enCurso: "DIARIO" };
      await act(async () => { boton().click(); });
      await asentar(SONDEO_MS);
      estado = { ...LIBRE, ultimo: { tarea: 5, estado: {} } as never };
      await asentar(SONDEO_MS * 2);
      expect(mensaje()).toBe(TEXTOS_RESUMEN_IA.boton.sinEstado);
    });
  });

  describe("cuidados del botón", () => {
    it("el botón apunta a su región de estado con aria-describedby", async () => {
      await montarBoton();
      const estadoEl = m.contenedor.querySelector(".resumen-ia-analizar-estado")!;
      expect(estadoEl.id).not.toBe("");
      expect(boton().getAttribute("aria-describedby")).toBe(estadoEl.id);
    });

    it("dos clics seguidos antes de que responda el servidor mandan UN solo pedido", async () => {
      await montarBoton();
      await act(async () => { boton().click(); boton().click(); });
      await asentar();
      expect(llamadas.filter((l) => l.init.method === "POST")).toHaveLength(1);
    });

    it("tras un pedido que falla, se puede volver a pedir (el cerrojo del doble envío se suelta)", async () => {
      await montarBoton();
      fetchFalso.mockRejectedValueOnce(new TypeError("x"));
      await act(async () => { boton().click(); });
      await asentar();
      expect(mensaje()).toBe(TEXTOS_RESUMEN_IA.boton.error);
      await act(async () => { boton().click(); });
      await asentar();
      expect(llamadas.filter((l) => l.init.method === "POST")).toHaveLength(1); // el primero lanzó antes de registrar
      expect(mensaje()).toBe("Analizando…");
    });

    it("al llegar al tope de sondeos dice que sigue en curso y que recargue, y el botón queda libre", async () => {
      estado = { ...LIBRE, enCurso: "DIARIO" };
      await montarBoton();
      expect(mensaje()).toBe("Analizando…");
      for (let i = 0; i < 125; i += 1) await asentar(SONDEO_MS);
      expect(mensaje()).toBe("El análisis sigue en curso; recargue en unos minutos.");
      expect(mensaje()).toBe(TEXTOS_RESUMEN_IA.boton.sigueEnCurso);
    });

    it("al desmontar se aborta la lectura del estado que estaba en vuelo", async () => {
      let senal: AbortSignal | undefined;
      fetchFalso.mockImplementationOnce((_url: string, init: RequestInit = {}) => {
        senal = init.signal ?? undefined;
        return new Promise<Response>(() => undefined);
      });
      await montarBoton();
      expect(senal).toBeDefined();
      expect(senal!.aborted).toBe(false);
      m.desmontar();
      expect(senal!.aborted).toBe(true);
    });

    it("un pedido que responde después de desmontar no deja temporizadores", async () => {
      let responder: (r: Response) => void = () => undefined;
      await montarBoton();
      fetchFalso.mockImplementationOnce(() => new Promise<Response>((r) => { responder = r; }));
      await act(async () => { boton().click(); });
      m.desmontar();
      expect(vi.getTimerCount()).toBe(0);
      responder(new Response(JSON.stringify({ codigo: "ESPERA_MINIMA", reintentarEnS: 75 }), { status: 429 }));
      await asentar();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it("los textos fijos del botón: sin lenguaje de consejo (con control positivo), sin «008» y sin códigos", () => {
    const fijos = JSON.stringify(Object.values(TEXTOS_RESUMEN_IA.boton)) + textoEspera(75);
    expect(prohibidasEn(fijos)).toEqual([]);
    expect(prohibidasEn("Le recomendamos vender ya")).not.toEqual([]);
    expect(fijos).not.toMatch(/\b008\b/);
    expect(fijos).not.toMatch(/\b[A-Z]{3,}_[A-Z_]+\b/);
  });
});
