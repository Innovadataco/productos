// @vitest-environment jsdom
// La pantalla /operar (frente operar-informe) con la sesión y los datos simulados: exige la sesión ANTES de leer; con la
// base caída muestra «No se pudo leer la base» (solo el código al registro); el familiar ve «Solo lectura»; la navegación
// lleva «Operar» como actual; el aviso fijo y la fecha de los precios; los tres grupos de reglas, el estado, las fechas
// y el enlace a los escenarios; sin formularios ni botones. Datos inventados (FICTICIA-*).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { armarInforme } from "@/operar/informe/armar";
import { esFechaDeNegocio } from "@/plan/fechas";
import { SECCIONES } from "@/app/tablero/secciones";
import { entradas, entradasCompletas, HOY, dia } from "./ficticio";

const exigirSesion = vi.hoisted(() => vi.fn());
const datosDeOperar = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirSesion }));
vi.mock("@/lib/db", () => ({ db: { soy: "la base" } }));
vi.mock("@/app/operar/datos", () => ({ datosDeOperar }));

import PaginaOperar, { metadata } from "@/app/operar/page";
import { Operar } from "@/app/operar/Operar";
import { aVistaOperar } from "@/app/operar/serializar";
import { AVISO_DECISION } from "@/app/operar/textos";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const VISTA = aVistaOperar(armarInforme(entradasCompletas(), HOY));
const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

function pantalla(html: string): HTMLElement {
  const raiz = document.createElement("div");
  raiz.innerHTML = html;
  return raiz;
}
const pintar = (vista = VISTA, soloLectura = false) => pantalla(renderToStaticMarkup(createElement(Operar, { vista, soloLectura })));
/** La sección de un h2 (una región con nombre) o el bloque de un h3 (un grupo de reglas, sin landmark). */
const grupo = (raiz: HTMLElement, id: string) => raiz.querySelector(`section[aria-labelledby="${id}"]`) ?? raiz.querySelector(`#${id}`)?.closest(".op-grupo") ?? null;
/** El texto de cada elemento de la lista; si trae párrafos, unidos por un espacio. */
const items = (raiz: HTMLElement, id: string) =>
  [...(grupo(raiz, id)?.querySelectorAll("li") ?? [])].map((li) => (li.querySelector("p") ? [...li.querySelectorAll("p")].map(texto).join(" ") : texto(li)));

beforeEach(() => {
  exigirSesion.mockResolvedValue({ id: "u-4613", email: "dueno@ejemplo.invalid", rol: "DUENO" });
  datosDeOperar.mockResolvedValue(VISTA);
});
afterEach(() => {
  vi.restoreAllMocks();
  exigirSesion.mockReset();
  datosDeOperar.mockReset();
});

describe("src/app/operar/page.tsx", () => {
  it("exige la sesión y después lee, con la base del proceso y el día de Colombia", async () => {
    const orden: string[] = [];
    exigirSesion.mockImplementationOnce(async () => { orden.push("sesion"); return { id: "u-4613", rol: "DUENO" }; });
    datosDeOperar.mockImplementationOnce(async () => { orden.push("datos"); return VISTA; });
    await PaginaOperar();
    expect(orden).toEqual(["sesion", "datos"]);
    const [base, hoy] = datosDeOperar.mock.calls[0]!;
    expect(base).toEqual({ soy: "la base" });
    expect(esFechaDeNegocio(hoy)).toBe(true);
  });

  it("sin sesión no lee nada: la redirección se propaga", async () => {
    exigirSesion.mockRejectedValueOnce(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/ingresar;307;" }));
    await expect(PaginaOperar()).rejects.toThrow("NEXT_REDIRECT");
    expect(datosDeOperar).not.toHaveBeenCalled();
  });

  it("con la base caída: «No se pudo leer la base» y solo el código al registro", async () => {
    datosDeOperar.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("falló en postgresql://u:clave-secreta@h", { code: "P2021", clientVersion: "5.22.0" }));
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const html = renderToStaticMarkup(await PaginaOperar());
    expect(html).toContain("No se pudo leer la base de 008");
    expect(registro).toHaveBeenCalledWith("[operar] no se pudo leer la base (código: P2021)");
    expect(JSON.stringify(registro.mock.calls)).not.toContain("clave-secreta");
  });

  it("otro error se propaga (lo atiende src/app/error.tsx)", async () => {
    datosDeOperar.mockRejectedValueOnce(new TypeError("x"));
    await expect(PaginaOperar()).rejects.toThrow(TypeError);
  });

  it("el familiar ve «Solo lectura» en el encabezado; el dueño no", async () => {
    exigirSesion.mockResolvedValueOnce({ id: "u-1237", rol: "FAMILIA" });
    expect(pantalla(renderToStaticMarkup(await PaginaOperar())).querySelector("header .solo-lectura")?.textContent).toBe("Solo lectura");
    expect(pantalla(renderToStaticMarkup(await PaginaOperar())).querySelector("header .solo-lectura")).toBeNull();
  });

  it("deriva la marca de la sesión revalidada, con la forma de las demás páginas", () => {
    const fuente = readFileSync(join(RAIZ, "src/app/operar/page.tsx"), "utf8");
    expect(fuente).toMatch(/const usuario = await exigirSesion\(\);/);
    expect(fuente).toMatch(/soloLectura = esSoloLectura\(usuario\);/);
    expect(fuente).toMatch(/soloLectura=\{soloLectura\}/);
    expect(fuente).toMatch(/export const dynamic = "force-dynamic";/);
  });

  it("el documento tiene su propio título", () => {
    expect(metadata.title).toBe("Informe para operar");
  });
});

describe("la pantalla", () => {
  it("la navegación: las secciones comunes, con «Operar» después de «Plan», como actual y una sola vez", () => {
    const nav = [...pintar().querySelectorAll('header nav[aria-label="Secciones"] a')].map((a) => [texto(a), a.getAttribute("href"), a.getAttribute("aria-current")]);
    expect(nav).toEqual(SECCIONES.map((s) => [s.texto, s.href, s.clave === "operar" ? "page" : null]));
    expect(nav.map(([t]) => t).slice(1, 3)).toEqual(["Plan", "Operar"]);
    expect(nav.filter(([t]) => t === "Operar")).toHaveLength(1);
    // El dueño ve «Configuración» al final (frente menu-configuracion); la familia, la lista de siempre sin ella.
    expect(nav.at(-1)).toEqual(["Configuración", "/edicion", null]);
    const familia = [...pintar(VISTA, true).querySelectorAll('header nav[aria-label="Secciones"] a')].map((a) => [texto(a), a.getAttribute("href"), a.getAttribute("aria-current")]);
    expect(familia).toEqual(nav.slice(0, -1));
    expect(familia.map(([t]) => t)).not.toContain("Configuración");
  });

  it("el título, el aviso fijo y los precios: último cierre disponible, y el aviso si la carga se detuvo", () => {
    const raiz = pintar();
    expect(texto(raiz.querySelector("h1"))).toBe("Informe para operar");
    expect(texto(grupo(raiz, "t-hero"))).toContain("Informe del 17-mar-2027");
    const aviso = raiz.querySelector('[role="note"]');
    expect(texto(aviso)).toBe(`${AVISO_DECISION} Precios: último cierre disponible (16-mar-2027).`);
    // Contenido estático: sin región viva (role=status solo anuncia cambios después de la carga).
    expect(raiz.querySelector('[role="status"], [aria-live]')).toBeNull();
    const detenida = pintar(aVistaOperar(armarInforme(entradasCompletas(), dia("2027-03-26"))));
    expect(detenida.querySelector('[role="status"], [aria-live]')).toBeNull();
    expect(texto(detenida.querySelector('[role="note"]'))).toBe(`${AVISO_DECISION} Precios: último cierre disponible (16-mar-2027). Atención: los precios no se han actualizado desde el 16-mar-2027.`);
  });

  it("el estado: una fila por especie viva, el cierre y su fecha, la atrasada marcada, la sin cierre y los totales", () => {
    const raiz = pintar();
    const tabla = grupo(raiz, "t-estado")?.querySelector("table") ?? null;
    expect(tabla?.closest('[role="region"]')?.getAttribute("tabindex")).toBe("0");
    expect(texto(tabla?.querySelector("caption"))).toBe("Estado por especie: cantidad, último cierre, valor, peso y ganancia o pérdida sin vender");
    expect(tabla?.hasAttribute("aria-labelledby")).toBe(false);
    expect([...(tabla?.querySelectorAll("thead th") ?? [])].map(texto)).toEqual(["Especie", "Cantidad", "Último cierre", "Valor", "Peso", "Ganancia o pérdida sin vender", "Sobre el costo (%)"]);
    const filas = [...(tabla?.querySelectorAll("tbody tr") ?? [])].map((tr) => [...tr.querySelectorAll("th, td")].map(texto));
    expect(filas.map((f) => f[0])).toEqual(["FICTICIA-A", "FICTICIA-B", "FICTICIA-C", "FICTICIA-E"]);
    expect(filas[0]).toEqual(["FICTICIA-A", "37", "$ 4.597,31 · 16-mar-2027", "$ 170.100", "52,02 %", "+$ 11.183", "+7,0 %"]);
    expect(filas[2]![2]).toBe("$ 899,11 · 12-mar-2027 cierre atrasado");
    expect(filas[3]!.slice(2)).toEqual(["sin cierre", "—", "—", "—", "—"]);
    expect([...(tabla?.querySelectorAll("tfoot th, tfoot td") ?? [])].map(texto)).toEqual(["Total", "", "", "$ 326.965", "", "+$ 18.905", ""]);
    expect(texto(grupo(raiz, "t-estado"))).toContain("No entran porque tienen ventas sin asignar: FICTICIA-I.");
  });

  it("sus reglas hoy, en tres grupos, con «Su regla … dice …», su estado y su plazo", () => {
    const raiz = pintar();
    expect(texto(grupo(raiz, "t-reglas"))).toContain("Plan vigente: versión 7, desde el 4-ene-2027.");
    expect(texto(raiz.querySelector("#t-se-cumplen"))).toBe("Se cumplen o están en el nivel");
    expect(items(raiz, "t-se-cumplen")).toEqual([
      "Su regla de FICTICIA-A dice: vender 37 acciones si el cierre queda por debajo de $ 4.613,17. La condición se da con el cierre del 16-mar-2027 ($ 4.597,31, por debajo del nivel), pero su plazo venció. Plazo: venció el 1-mar-2027.",
      "Su regla de FICTICIA-A dice: comprar si el cierre queda por encima de $ 4.597,31. El cierre del 16-mar-2027 quedó en el nivel: $ 4.597,31. Plazo: sin plazo.",
      "Su regla de FICTICIA-B dice: vender 7 acciones si el cierre queda por debajo de $ 1.301,17. Hoy se cumple: el cierre del 16-mar-2027 fue de $ 1.237, por debajo del nivel. Plazo: sin plazo.",
    ]);
    expect(items(raiz, "t-cercanas")).toEqual([
      "Su regla de FICTICIA-B dice: vender 13 acciones si el cierre queda por encima de $ 1.259,17. El cierre del 16-mar-2027 fue de $ 1.237: le falta subir 1,79 % para tocar su nivel. Plazo: hasta el 2-abr-2027.",
    ]);
    const resto = items(raiz, "t-resto");
    expect(resto).toHaveLength(4);
    expect(resto[1]).toBe("Su regla de FICTICIA-C dice: comprar 1 acción si el cierre queda por debajo de $ 917,43. Sin cierre al día: el último cierre es del 12-mar-2027 ($ 899,11). Plazo: sin plazo.");
    expect(resto[0]).toContain("no actuar (43 acciones), sin condición. Es una postura del plan");
    expect(resto[0]).toContain("Plazo: hasta el 14-may-2027.");
    expect(resto.join(" ")).toContain("Su regla de portafolio dice: «Orden límite siempre (ficticia)».");
    expect(resto.join(" ")).toContain("Inversiones no la mide con los cierres: aplica al monto de cada orden.");
    expect(grupo(raiz, "t-se-cumplen")?.querySelectorAll(".aviso")).toHaveLength(2);
  });

  it("con la carga de precios detenida, ninguna regla dice «Hoy se cumple»", () => {
    const raiz = pintar(aVistaOperar(armarInforme(entradasCompletas(), dia("2027-03-26"))));
    expect(texto(raiz)).not.toContain("Hoy se cumple");
    expect(items(raiz, "t-se-cumplen")[2]).toContain("Se cumple con el último cierre disponible, del 16-mar-2027: $ 1.237, por debajo del nivel.");
  });

  it("sin plan y sin especies: los avisos de vacío, nunca una tabla sin filas", () => {
    const raiz = pintar(aVistaOperar(armarInforme(entradas({ especies: [] }), HOY)));
    expect(texto(grupo(raiz, "t-reglas"))).toContain("Hoy no rige ninguna versión del plan.");
    expect(grupo(raiz, "t-reglas")?.querySelectorAll(".op-grupo")).toHaveLength(0);
    expect(raiz.querySelector("table")).toBeNull();
    expect(texto(grupo(raiz, "t-estado"))).toContain("No hay especies vivas en el portafolio.");
    expect(texto(grupo(raiz, "t-fechas"))).toContain("No hay ex-dividendos ni plazos de reglas en los próximos 30 días.");
    expect(texto(raiz.querySelector('[role="note"]'))).toContain("Precios: todavía no hay cierres de las especies del portafolio.");
  });

  it("con plan y grupos vacíos, cada grupo lo dice", () => {
    const raiz = pintar(aVistaOperar(armarInforme(entradas({ plan: { numero: 3, vigenteDesde: dia("2027-01-04"), reglas: [] } }), HOY)));
    expect(texto(grupo(raiz, "t-se-cumplen"))).toContain("Hoy ninguna regla se cumple ni está en su nivel.");
    expect(texto(grupo(raiz, "t-cercanas"))).toContain("Ninguna regla está a menos del 3 % de su nivel.");
    expect(texto(grupo(raiz, "t-resto"))).toContain("No hay más reglas.");
  });

  it("las fechas, en orden, y los escenarios como enlace a /proyecciones", () => {
    const raiz = pintar();
    expect(items(raiz, "t-fechas")).toEqual([
      "24-mar-2027 · Ex-dividendo de FICTICIA-D: ordinario, cuota 2: $ 37,91 por acción; pago el 31-mar-2027; sin acciones hoy.",
      "2-abr-2027 · Último día del plazo de su regla de FICTICIA-B, que dice: vender 13 acciones si el cierre queda por encima de $ 1.259,17.",
    ]);
    expect(texto(grupo(raiz, "t-fechas"))).toContain("Del 17-mar-2027 al 16-abr-2027.");
    const enlace = grupo(raiz, "t-escenarios")?.querySelector("a");
    expect([texto(enlace), enlace?.getAttribute("href")]).toEqual(["Proyecciones", "/proyecciones"]);
  });

  it("no tiene formularios, campos ni botones, y cada región tiene un nombre propio", () => {
    const raiz = pintar();
    expect(raiz.querySelectorAll("form, input, button, textarea, select")).toHaveLength(0);
    const ids = [...raiz.querySelectorAll("section[aria-labelledby]")].map((s) => s.getAttribute("aria-labelledby")!);
    for (const id of ids) expect(raiz.querySelector(`#${id}`), id).not.toBeNull();
    // Una sección con nombre ya es una región: ninguna región (secciones y cajas desplazables) repite el nombre.
    const nombre = (e: Element) => e.getAttribute("aria-label") ?? texto(raiz.querySelector(`#${e.getAttribute("aria-labelledby")}`));
    const nombres = [...raiz.querySelectorAll('section[aria-labelledby], [role="region"]')].map(nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
    // Los grupos de reglas no son regiones: el h3 basta (menos ruido al navegar por landmarks).
    expect(raiz.querySelectorAll(".op-grupo[aria-labelledby], section.op-grupo")).toHaveLength(0);
    expect(raiz.querySelectorAll(".op-grupo h3")).toHaveLength(3);
  });

  it("las listas sin viñetas conservan su semántica (role=list)", () => {
    const listas = [...pintar().querySelectorAll("ul.op-reglas, ol.op-fechas")];
    expect(listas).toHaveLength(4);
    for (const l of listas) expect(l.getAttribute("role")).toBe("list");
  });

  it("el color de la ganancia o pérdida sigue al signo del texto: lo que redondea a cero no lleva color", () => {
    const [a, , c] = VISTA.estado.especies;
    const vista = { ...VISTA, estado: { ...VISTA.estado, especies: [{ ...a!, sinVender: "-0.4", sinVenderPct: "-0.04" }, c!] } };
    const filas = [...(pintar(vista).querySelectorAll("tbody tr"))].map((tr) => [...tr.querySelectorAll("td")].slice(4).map((td) => [texto(td), td.className]));
    expect(filas[0]).toEqual([["$ 0", "num"], ["0,0 %", "num"]]);
    expect(filas[1]).toEqual([["−$ 348", "num loss"], ["−2,0 %", "num loss"]]);
    expect([...pintar().querySelectorAll("tbody tr")][0]!.querySelectorAll("td.gain")).toHaveLength(2);
  });
});
