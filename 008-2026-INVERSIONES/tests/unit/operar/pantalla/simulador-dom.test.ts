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
import { prohibidasEn } from "../informe/lenguaje";

const ESPECIES = [{ id: "id-ficticia-a", nemotecnico: "FICTICIA-A", cantidad: "1.237" }, { id: "id-ficticia-b", nemotecnico: "FICTICIA-B", cantidad: "379" }];
const VISTA: VistaSimulacion = {
  especies: [{ nemotecnico: "FICTICIA-A", operada: true, cantidadAntes: "1.237", cantidadDespues: "1.240", pesoAntes: "99,92 %", pesoDespues: "99,92 %" }],
  valorOrden: "$ 13.839,81",
  comision: { fuente: "TARIFA", valor: "$ 49,9523", texto: "calculada con su tarifa de Trii para compra · versión 3" },
  cajaAntes: "$ 37.911,47", cajaDespues: "$ 24.021,7077", cajaFuente: "Caja certificada por Acciones & Valores al 12-mar-2027.",
  valorAccionesAntes: "$ 5.711.154,47", valorAccionesDespues: "$ 5.725.004,28",
  reglas: [{ texto: "Su regla de FICTICIA-A dice: vender 41.", afectaciones: ["Su plan para esta especie dice: vender 41."] }],
  avisos: ["Aviso ficticio."], notas: ["Nota ficticia."],
  analisis: {
    filas: [{ titulo: "Peso de FICTICIA-A", antes: "21,13 %", despues: "52,37 %" }],
    escenarios: [{ titulo: "A 12 meses (p5 · p50 · p95)", antes: "$ 37.911 · $ 47.114 · $ 57.311", despues: "$ 35.717 · $ 47.391 · $ 59.138", variacion: "−5,79 % · +0,59 % · +3,19 %" }],
    partida: [{ titulo: "Caja (parte fija, sin rendimiento)", antes: "$ 9.372", despues: "$ 4.745" }],
    notaCaja: "Nota ficticia de la caja de los escenarios.",
    paraRevisar: [], aparecen: ["concentración alta en FICTICIA-A"], desaparecen: [],
    frases: ["Frase ficticia del análisis."], rotulo: "Análisis calculado por Inversiones · la IA lo redactará cuando el servicio de IA esté conectado",
  },
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
    await cambiar(control("sim-saldo"), "37.911,47");
    await enviar();
    expect(texto(m.contenedor)).toContain(T.CALCULANDO);
    const [url, init] = fetchFalso.mock.calls[0]!;
    expect(url).toBe("/api/operar/simular");
    expect(JSON.parse(String(init.body))).toEqual({ instrumentoId: "id-ficticia-b", lado: "VENDER", cantidad: "7", precioLimite: "11,71", comisionista: "AV", saldoComisionista: "37.911,47", precioActual: "" });
    await responder({ ok: true, vista: VISTA }, 200);
    const todo = texto(m.contenedor);
    for (const t of ["$ 13.839,81", "$ 49,9523", "Comisión (de su tarifa)", "antes: $ 37.911,47", "después: $ 24.021,7077", "Caja certificada", "Su regla de FICTICIA-A dice", "Aviso ficticio.", "Nota ficticia."]) expect(todo).toContain(t);
    for (const t of [T.ANALISIS, "Peso de FICTICIA-A", "después: 52,37 %", "A 12 meses (p5 · p50 · p95)", T.APARECEN, "concentración alta en FICTICIA-A", "Frase ficticia del análisis.", "la IA lo redactará", T.PARTIDA, "Caja (parte fija, sin rendimiento)", "antes: $ 9.372", "después: $ 4.745", "variación: −5,79 % · +0,59 % · +3,19 %", "Nota ficticia de la caja de los escenarios."]) expect(todo).toContain(t);
    expect(m.contenedor.querySelector(".op-sim-operada th")?.textContent).toBe("FICTICIA-A");
  });

  it("el precio actual de trii Pro: un campo opcional con su ayuda, que viaja en el pedido tal como se escribió", async () => {
    await m.pintar(createElement(Simulador, { especies: ESPECIES }));
    expect(T.PRECIO_ACTUAL).toBe("Precio actual en trii Pro ($, opcional)");
    expect(T.AYUDA_PRECIO_ACTUAL).toBe(
      "El precio que ve en trii Pro, como en la ficha (2.345,5), sin signo $. Si lo escribe, la especie se valora a ese precio y no al último cierre; no se guarda. Hasta un millón de pesos y dos decimales.",
    );
    expect(texto(m.contenedor.querySelector("label[for=sim-precio-actual]"))).toBe(T.PRECIO_ACTUAL);
    expect(texto(m.contenedor.querySelector("#sim-ayuda-precio-actual"))).toBe(T.AYUDA_PRECIO_ACTUAL);
    const campo = control<HTMLInputElement>("sim-precio-actual");
    expect(campo.getAttribute("aria-describedby")).toBe("sim-ayuda-precio-actual");
    expect(campo.value).toBe("");
    await cambiar(campo, "2.345,5");
    await enviar();
    expect(JSON.parse(String(fetchFalso.mock.calls[0]![1].body))).toMatchObject({ precioActual: "2.345,5" });
  });

  describe("los campos con error", () => {
    const IDS: Readonly<Record<string, string>> = { cantidad: "sim-cantidad", precioLimite: "sim-precio", saldoComisionista: "sim-saldo", precioActual: "sim-precio-actual" };
    const invalido = (id: string) => control(id).getAttribute("aria-invalid");
    const describe_ = (id: string) => (control(id).getAttribute("aria-describedby") ?? "").split(" ");

    it("el campo que la ruta rechaza lleva aria-invalid y su descripción incluye el mensaje de error, además de su ayuda", async () => {
      await m.pintar(createElement(Simulador, { especies: ESPECIES }));
      await enviar();
      await responder({ error: "x", campos: ["precioActual"] }, 400);
      const alerta = m.contenedor.querySelector<HTMLElement>(".op-sim-errores")!;
      expect(alerta.id).not.toBe("");
      expect(invalido("sim-precio-actual")).toBe("true");
      expect(describe_("sim-precio-actual")).toEqual(["sim-ayuda-precio-actual", alerta.id]);
      for (const id of ["sim-cantidad", "sim-precio", "sim-saldo"]) expect(invalido(id), id).toBeNull();
      expect(describe_("sim-saldo")).toEqual(["sim-ayuda-saldo"]);
    });

    it("con varios campos, cada uno queda marcado y los demás no", async () => {
      await m.pintar(createElement(Simulador, { especies: ESPECIES }));
      await enviar();
      await responder({ error: "x", campos: ["cantidad", "precioLimite", "saldoComisionista", "precioActual", "inventado"] }, 400);
      for (const id of Object.values(IDS)) expect(invalido(id), id).toBe("true");
      expect(describe_("sim-cantidad")).toEqual(["sim-ayuda", m.contenedor.querySelector(".op-sim-errores")!.id]);
    });

    it("al volver a enviar, o con un resultado, las marcas se quitan", async () => {
      await m.pintar(createElement(Simulador, { especies: ESPECIES }));
      await enviar();
      await responder({ error: "x", campos: ["precioActual"] }, 400);
      await enviar();
      expect(invalido("sim-precio-actual")).toBeNull();
      expect(describe_("sim-precio-actual")).toEqual(["sim-ayuda-precio-actual"]);
      await responder({ ok: true, vista: VISTA }, 200);
      expect(invalido("sim-precio-actual")).toBeNull();
    });

    it("un error sin campos (sesión, demasiadas, fallo) no marca ninguno", async () => {
      await m.pintar(createElement(Simulador, { especies: ESPECIES }));
      await enviar();
      await responder("no es json", 500);
      for (const id of Object.values(IDS)) expect(invalido(id), id).toBeNull();
    });
  });

  it("sin reglas ni avisos, y sin valor de comisión, lo dice", async () => {
    await m.pintar(createElement(Simulador, { especies: ESPECIES }));
    await enviar();
    await responder({ ok: true, vista: { ...VISTA, reglas: [], avisos: [], comision: { fuente: "SIN_HISTORIA", valor: null, texto: "sin historia: no se estima" } } }, 200);
    expect(texto(m.contenedor)).toContain(T.SIN_REGLAS);
    expect(texto(m.contenedor)).toContain("Comisión (no se estima)");
    expect(m.contenedor.querySelector(".op-sim-avisos")).toBeNull();
  });

  it("sin análisis ni escenarios, lo dice", async () => {
    await m.pintar(createElement(Simulador, { especies: ESPECIES }));
    await enviar();
    await responder({ ok: true, vista: { ...VISTA, analisis: null } }, 200);
    expect(texto(m.contenedor)).toContain(T.SIN_ANALISIS);
    await enviar();
    await responder({ ok: true, vista: { ...VISTA, analisis: { ...VISTA.analisis!, escenarios: [] } } }, 200);
    expect(texto(m.contenedor)).toContain(T.SIN_ESCENARIOS);
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

  it("accesibilidad (revisión de React): el error toma el foco y se anuncia una vez; el resultado, con una línea corta", async () => {
    await m.pintar(createElement(Simulador, { especies: ESPECIES }));
    expect(m.contenedor.querySelector("form")?.getAttribute("aria-labelledby")).toBe("t-simulador");
    await enviar();
    expect(m.contenedor.querySelector("button[type=submit]")?.getAttribute("aria-disabled")).toBe("true");
    await responder({ ok: false, errores: ["Error ficticio."] }, 200);
    const alerta = m.contenedor.querySelector("[role=alert]")!;
    expect(alerta.closest("[aria-live]")).toBeNull();
    expect(document.activeElement).toBe(alerta);
    expect(m.contenedor.querySelector("button[type=submit]")?.getAttribute("aria-disabled")).toBeNull();
    await enviar();
    await responder({ ok: true, vista: VISTA }, 200);
    // Sin regiones vivas en <main> (contrato de /operar, tests/e2e/operar.spec.ts): el resultado toma el foco en su título.
    expect(m.contenedor.querySelector("[role=status], [aria-live]")).toBeNull();
    expect(document.activeElement).toBe(m.contenedor.querySelector(".op-sim-resultado h3"));
    const region = m.contenedor.querySelector(".tabla[role=region]")!;
    expect(region.getAttribute("aria-label")).toBeNull();
    expect(texto(document.getElementById(region.getAttribute("aria-labelledby")!))).toBe(T.PESOS);
  });

  describe("Para revisar", () => {
    const ITEMS = [
      { nivel: "ALTA", importancia: "Importancia alta", frase: "El peso de «FICTICIA-B» pasa de elevado a muy elevado", nota: "Antes 30,00 % · después 45,13 % · umbral más de 40,00 %" },
      { nivel: "MEDIA", importancia: "Importancia media", frase: "La concentración del portafolio (HHI) pasa a ser elevada", nota: "Antes sin punto · después 0,300 · umbral más de 0,250" },
      { nivel: "BAJA", importancia: "Importancia baja", frase: "El efecto de una caída de «FICTICIA-A» en el portafolio pasa a ser mediano", nota: "Antes sin punto · después 5,10 % · umbral desde 5,00 %" },
    ];
    const conItems = async (paraRevisar: unknown) => {
      await m.pintar(createElement(Simulador, { especies: ESPECIES }));
      await enviar();
      await responder({ ok: true, vista: { ...VISTA, analisis: { ...VISTA.analisis!, paraRevisar } } }, 200);
    };

    it("va después del título del resultado, con su h4 y una lista ordenada que él nombra", async () => {
      await conItems(ITEMS);
      const resultado = m.contenedor.querySelector(".op-sim-resultado")!;
      const h4 = [...resultado.querySelectorAll<HTMLElement>("h4")].find((x) => texto(x) === T.PARA_REVISAR)!;
      expect(h4.id).not.toBe("");
      expect(texto(h4)).toBe(T.PARA_REVISAR);
      expect(T.PARA_REVISAR).toBe("Para revisar");
      expect(h4.previousElementSibling?.tagName).toBe("H3");
      const lista = h4.nextElementSibling!;
      expect(lista.tagName).toBe("OL");
      expect(lista.getAttribute("aria-labelledby")).toBe(h4.id);
    });
    it("cada ítem empieza con la importancia en texto, sigue la frase y la nota, en el orden recibido", async () => {
      await conItems(ITEMS);
      const li = [...m.contenedor.querySelectorAll(".op-sim-revisar > li")];
      expect(li.map((x) => texto(x.firstElementChild))).toEqual(["Importancia alta", "Importancia media", "Importancia baja"]);
      expect(li.map((x) => texto(x.children[1]))).toEqual(ITEMS.map((i) => i.frase));
      expect(li.map((x) => texto(x.querySelector(".nota")))).toEqual(ITEMS.map((i) => i.nota));
      expect(li.map((x) => x.getAttribute("data-importancia"))).toEqual(["alta", "media", "baja"]);
    });
    it("el id del título es propio de cada montaje (useId): no es un literal fijo", async () => {
      await conItems(ITEMS);
      const h4 = [...m.contenedor.querySelectorAll<HTMLElement>("h4")].find((x) => texto(x) === T.PARA_REVISAR)!;
      expect(h4.id).not.toBe("sim-para-revisar");
    });
    it("sin cambios dice que ningún punto cambia de rango", async () => {
      await conItems([]);
      expect(m.contenedor.querySelector(".op-sim-revisar")).toBeNull();
      expect(texto(m.contenedor.querySelector(".op-sim-resultado h4 + p"))).toBe("Ningún punto cambia de rango con esta operación");
    });
    it("sin análisis no hay sección, y la sección no usa regiones vivas", async () => {
      await m.pintar(createElement(Simulador, { especies: ESPECIES }));
      await enviar();
      await responder({ ok: true, vista: { ...VISTA, analisis: null } }, 200);
      expect([...m.contenedor.querySelectorAll("h4")].some((x) => texto(x) === T.PARA_REVISAR)).toBe(false);
      await enviar();
      await responder({ ok: true, vista: { ...VISTA, analisis: { ...VISTA.analisis!, paraRevisar: ITEMS } } }, 200);
      expect(m.contenedor.querySelector("[aria-live], [role=status], [role=alert]")).toBeNull();
    });
    it("el texto de la sección no trae lenguaje de consejo (con control positivo)", async () => {
      await conItems(ITEMS);
      expect(prohibidasEn(texto(m.contenedor.querySelector(".op-sim-revisar")))).toEqual([]);
      expect(prohibidasEn("compre ya")).not.toEqual([]);
    });
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
