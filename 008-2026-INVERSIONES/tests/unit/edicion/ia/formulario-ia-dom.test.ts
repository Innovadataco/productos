// @vitest-environment jsdom
// El formulario de /edicion/ia (E8) en el navegador: envía lo que el dueño escribió a POST /api/ia/config con la última
// versión que vio; con 201 recarga la página con la versión guardada; con 400 el resumen toma el foco y el campo queda
// marcado con el mensaje de su código. «Identificar modelos» y «Probar» mandan SOLO la acción (nunca un destino: el
// servidor usa el guardado) y muestran lo que vuelve: cada modelo en la lista de PI o fuera de ella, el aviso de los
// 32B, la sonda pendiente y «Ollama inalcanzable» con la posibilidad del firewall. Datos inventados.
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ir = vi.hoisted(() => vi.fn());
vi.mock("@/app/edicion/enviar", async (original) => ({ ...(await original<typeof import("@/app/edicion/enviar")>()), irA: ir }));

import { FormularioIa } from "@/app/edicion/ia/FormularioIa";
import { AVISOS_IA, mensajeIa } from "@/app/edicion/ia/textos-ia";
import { montar, texto, type Montaje } from "../../graficas/dom";
import { DATOS_IA_FICTICIOS as DATOS } from "./datos.ficticio";

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

const boton = (nombre: string) => [...m.contenedor.querySelectorAll("button")].find((b) => texto(b) === nombre) as HTMLButtonElement | undefined;
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
const cuerpoEnviado = (i = 0) => JSON.parse(String(fetchFalso.mock.calls[i]![1].body)) as Record<string, unknown>;

describe("FormularioIa · guardar", () => {
  it("cada control tiene su etiqueta, y el aviso del firewall va junto al destino", async () => {
    await m.pintar(createElement(FormularioIa, { datos: DATOS }));
    const sinEtiqueta = [...m.contenedor.querySelectorAll("input, select, textarea")].filter((c) => (c as HTMLInputElement).labels?.length === 0);
    expect(sinEtiqueta.map((c) => c.id)).toEqual([]);
    expect(texto(control("ia-destino"))).toContain(AVISOS_IA.FIREWALL);
    expect(texto(m.contenedor)).toContain(AVISOS_IA.NUBE_COSTO);
  });

  it("envía lo escrito con la versión que vio; con 201 recarga con la versión guardada", async () => {
    await m.pintar(createElement(FormularioIa, { datos: DATOS }));
    await cambiar(control<HTMLTextAreaElement>("ia-motivo"), "Motivo ficticio del cambio");
    await cambiar(control<HTMLInputElement>("ia-tope"), "5,37");
    await act(async () => { boton("Guardar la versión nueva")!.click(); });
    const [url, init] = fetchFalso.mock.calls[0]!;
    expect(url).toBe("/api/ia/config");
    expect(init.method).toBe("POST");
    expect(cuerpoEnviado()).toEqual({
      versionBase: 7, modo: "local-luego-nube", ollamaHost: "", ollamaPuerto: "", temperatura: "0",
      tareas: { DIARIO: { activo: true, modeloLocal: "qwen2.5:14b" }, REGLAS: { activo: true, modeloLocal: "aya-expanse:32b" }, ESCENARIOS: { activo: false, modeloLocal: "" } },
      modeloNube: "claude-opus-5-5", esfuerzoNube: "low", topeMensualUsd: "5,37", horaResumen: "19:00", limiteSegundos: "120", motivo: "Motivo ficticio del cambio",
    });
    await responder({ version: 8 }, 201);
    expect(ir).toHaveBeenCalledWith("/edicion/ia?guardada=8");
  });

  it("con 400 el resumen toma el foco y el campo queda marcado con el mensaje de su código", async () => {
    await m.pintar(createElement(FormularioIa, { datos: DATOS }));
    await cambiar(control<HTMLSelectElement>("ia-modo"), "nube");
    await cambiar(control<HTMLInputElement>("ia-tope"), "");
    await act(async () => { boton("Guardar la versión nueva")!.click(); });
    await responder({ error: "Revise los datos marcados.", codigo: "DATOS_INVALIDOS", campos: [{ campo: "topeMensualUsd", codigo: "TOPE_FALTA" }] }, 400);
    expect(document.activeElement?.classList.contains("edicion-resumen")).toBe(true);
    expect(texto(m.contenedor.querySelector(".edicion-resumen"))).toContain(mensajeIa("TOPE_FALTA"));
    expect(control("ia-tope").getAttribute("aria-invalid")).toBe("true");
    expect(ir).not.toHaveBeenCalled();
  });

  it("con 409 (otra versión en medio) lo dice, sin navegar", async () => {
    await m.pintar(createElement(FormularioIa, { datos: DATOS }));
    await cambiar(control<HTMLTextAreaElement>("ia-motivo"), "Motivo ficticio");
    await act(async () => { boton("Guardar la versión nueva")!.click(); });
    await responder({ error: "x", campos: [{ campo: "versionBase", codigo: "CONFIG_CAMBIO" }] }, 409);
    expect(texto(m.contenedor.querySelector(".edicion-resumen"))).toContain(mensajeIa("CONFIG_CAMBIO"));
  });

  it("con más de 0 de temperatura, el aviso; junto al 32B, el de la recarga en frío", async () => {
    await m.pintar(createElement(FormularioIa, { datos: DATOS }));
    expect(texto(m.contenedor)).toContain(AVISOS_IA.TEMPERATURA);
    expect(texto(m.contenedor)).toContain(AVISOS_IA.RECARGA_32B);
  });
});

describe("FormularioIa · identificar y probar (solo el destino guardado)", () => {
  it("identificar manda SOLO la acción y marca cada modelo en la lista de PI o fuera de ella", async () => {
    await m.pintar(createElement(FormularioIa, { datos: DATOS }));
    await act(async () => { boton("Identificar modelos")!.click(); });
    expect(fetchFalso.mock.calls[0]![0]).toBe("/api/ia/ollama");
    expect(cuerpoEnviado()).toEqual({ accion: "identificar" });
    await responder({
      accion: "identificar",
      resultado: {
        estado: "OK",
        modelos: [
          { nombre: "qwen2.5:14b", tamanoBytes: 9_037_911_473, digest: "4613a27c".repeat(8), enLista: true, digestCoincide: true, seleccionable: true, nota: null },
          { nombre: "llama3.1:8b", tamanoBytes: 4_613_000_000, digest: "37911f47".repeat(8), enLista: false, digestCoincide: null, seleccionable: false, nota: null },
          { nombre: "gemma2:27b", tamanoBytes: 15_461_237_377, digest: "9".repeat(64), enLista: true, digestCoincide: false, seleccionable: false, nota: null },
        ],
      },
    }, 200);
    const lista = texto(m.contenedor.querySelector('[aria-labelledby="t-instalados"]'));
    expect(lista).toContain("qwen2.5:14b");
    expect(lista).toContain(TEXTO_EN_LISTA);
    expect(lista).toContain("llama3.1:8b");
    expect(lista).toContain(AVISOS_IA.FUERA_DE_LISTA);
    expect(lista).toContain(AVISOS_IA.DIGEST_DISTINTO);
    // En el selector, gemma (con otro digest) no se puede elegir; qwen sí.
    const opciones = [...control<HTMLSelectElement>("ia-tarea-DIARIO-modelo").options];
    expect(opciones.find((o) => o.value === "gemma2:27b")?.disabled).toBe(true);
    expect(opciones.find((o) => o.value === "qwen2.5:14b")?.disabled).toBe(false);
  });

  it("la sonda pendiente (producción): lo dice con el texto honesto", async () => {
    await m.pintar(createElement(FormularioIa, { datos: DATOS }));
    await act(async () => { boton("Identificar modelos")!.click(); });
    await responder({ accion: "identificar", resultado: { estado: "PENDIENTE" } }, 200);
    expect(texto(m.contenedor.querySelector('[role="status"].ia-sonda'))).toContain(AVISOS_IA.SONDA_PENDIENTE);
  });

  it("Ollama inalcanzable (503): lo dice, con la posibilidad del bloqueo del firewall y sin datos", async () => {
    await m.pintar(createElement(FormularioIa, { datos: DATOS }));
    await act(async () => { boton("Probar")!.click(); });
    expect(cuerpoEnviado()).toEqual({ accion: "probar" });
    await responder({ accion: "probar", error: "Ollama inalcanzable", resultado: { estado: "INALCANZABLE", detalle: "CONEXION_RECHAZADA" } }, 503);
    expect(texto(m.contenedor.querySelector('[role="status"].ia-sonda'))).toContain(AVISOS_IA.INALCANZABLE);
  });

  it("probar: la latencia y el resultado de cada modelo", async () => {
    await m.pintar(createElement(FormularioIa, { datos: DATOS }));
    await act(async () => { boton("Probar")!.click(); });
    await responder({ accion: "probar", resultado: { estado: "FALLO", pruebas: [
      { modelo: "qwen2.5:14b", ok: true, latenciaMs: 1237, etapa: null, detalle: null, inalcanzable: false },
      { modelo: "aya-expanse:32b", ok: false, latenciaMs: 41, etapa: "PING", detalle: "CONEXION_RECHAZADA", inalcanzable: true },
    ] } }, 200);
    const r = texto(m.contenedor.querySelector('[aria-labelledby="t-pruebas"]'));
    expect(r).toContain("qwen2.5:14b");
    expect(r).toContain("1.237 ms");
    expect(r).toContain(AVISOS_IA.INALCANZABLE);
  });

  it("sin destino guardado, los botones lo dicen y no se envía nada", async () => {
    await m.pintar(createElement(FormularioIa, { datos: { ...DATOS, guardado: { ...DATOS.guardado, hayDestino: false } } }));
    expect(boton("Identificar modelos")?.disabled).toBe(true);
    expect(texto(m.contenedor)).toContain(AVISOS_IA.GUARDE_DESTINO);
  });

  it("429: lo dice (un pedido cada pocos segundos)", async () => {
    await m.pintar(createElement(FormularioIa, { datos: DATOS }));
    await act(async () => { boton("Identificar modelos")!.click(); });
    await responder({ error: "Demasiadas solicitudes" }, 429);
    expect(texto(m.contenedor.querySelector('[role="status"].ia-sonda'))).toContain(mensajeIa("DEMASIADAS"));
  });
});

const TEXTO_EN_LISTA = "En la lista de PI";

// Revisión (react): lo que se ve es lo que se envía; una opción que no se puede elegir dice por qué; un doble clic no
// manda dos pedidos; una respuesta con otra forma no tumba la pantalla.
describe("FormularioIa · hallazgos de la revisión", () => {
  it("un modelo guardado que ya no está en la lista de PI se ve como opción (deshabilitada) y no se pierde en silencio", async () => {
    const datos = { ...DATOS, inicial: { ...DATOS.inicial, tareas: { ...DATOS.inicial.tareas, ESCENARIOS: { activo: false, modeloLocal: "ornith:9b" } } }, guardado: { ...DATOS.guardado, modelos: { ...DATOS.guardado.modelos, ESCENARIOS: "ornith:9b" } } };
    await m.pintar(createElement(FormularioIa, { datos }));
    const select = control<HTMLSelectElement>("ia-tarea-ESCENARIOS-modelo");
    expect(select.value).toBe("ornith:9b");
    const opcion = [...select.options].find((o) => o.value === "ornith:9b");
    expect(opcion?.disabled).toBe(true);
    expect(opcion?.textContent).toContain(AVISOS_IA.YA_NO_EN_LISTA);
  });

  it("las opciones que no se pueden elegir dicen por qué (sin identificar), y la ayuda va enlazada al selector", async () => {
    await m.pintar(createElement(FormularioIa, { datos: DATOS }));
    const select = control<HTMLSelectElement>("ia-tarea-DIARIO-modelo");
    expect([...select.options].find((o) => o.value === "gemma2:27b")?.textContent).toContain(AVISOS_IA.SIN_IDENTIFICAR);
    expect(select.getAttribute("aria-describedby")).toContain("ia-tarea-DIARIO-modelo-ayuda");
  });

  it("un doble clic en identificar manda un solo pedido, y los botones se deshabilitan mientras consulta", async () => {
    await m.pintar(createElement(FormularioIa, { datos: DATOS }));
    await act(async () => {
      boton("Identificar modelos")!.click();
      boton("Identificar modelos")!.click();
    });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(boton("Probar")?.disabled).toBe(true);
    await responder({ accion: "identificar", resultado: { estado: "PENDIENTE" } }, 200);
    expect(boton("Probar")?.disabled).toBe(false);
  });

  it("una respuesta OK sin la lista de modelos no tumba la pantalla: dice que no se pudo", async () => {
    await m.pintar(createElement(FormularioIa, { datos: DATOS }));
    await act(async () => { boton("Identificar modelos")!.click(); });
    await responder({ accion: "identificar", resultado: { estado: "OK" } }, 200);
    expect(texto(m.contenedor.querySelector('[role="status"].ia-sonda'))).toContain(mensajeIa("DESCONOCIDO"));
  });
});
