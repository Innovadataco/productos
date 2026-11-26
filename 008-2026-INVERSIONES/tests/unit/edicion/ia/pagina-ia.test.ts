// @vitest-environment jsdom
// /edicion/ia (E8) con el guardián y las lecturas simulados: exige al dueño ANTES de leer (a la familia, exigirDueno le
// da 404 y no se lee nada); pinta los avisos fijos (el costo y lo que sale a Anthropic, el firewall junto al destino, la
// temperatura), lo que no se configura con su razón, el estado de cada puerta (con «por verificar», nunca «listo»), el
// gasto del mes frente al tope, la llave solo como sí/no, la historia y el pie que dice que no se recomienda comprar ni
// vender; sin base, el aviso de siempre. Y los textos: cada código del servidor tiene su mensaje. Datos inventados.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosEdicionIa } from "@/app/edicion/ia/tipos-ia";

const exigirDueno = vi.hoisted(() => vi.fn());
const datosEdicionIa = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirDueno }));
vi.mock("@/lib/db", () => ({ db: { soy: "la base" } }));
vi.mock("@/app/edicion/ia/datos", () => ({ datosEdicionIa }));

import PaginaIa from "@/app/edicion/ia/page";
import { AVISOS_IA, CODIGOS_CON_MENSAJE, FIJOS_IA, mensajeIa, TEXTOS_IA } from "@/app/edicion/ia/textos-ia";
import { PIE_EDICION } from "@/app/edicion/textos";
import { DATOS_IA_FICTICIOS } from "./datos.ficticio";

const DUENO = { id: "u-dueno", email: "dueno@ejemplo.invalid", rol: "DUENO" };
const DATOS: DatosEdicionIa = DATOS_IA_FICTICIOS;
const consulta = (q: Record<string, string> = {}) => ({ searchParams: Promise.resolve(q) });
const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

async function pantalla(p: Promise<React.ReactElement>): Promise<HTMLElement> {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(await p);
  return raiz;
}

beforeEach(() => {
  exigirDueno.mockResolvedValue(DUENO);
  datosEdicionIa.mockResolvedValue(DATOS);
});
afterEach(() => {
  for (const f of [exigirDueno, datosEdicionIa]) f.mockReset();
  vi.restoreAllMocks();
});

describe("/edicion/ia", () => {
  it("la familia (exigirDueno lanza el 404) no llega a leer nada", async () => {
    exigirDueno.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(PaginaIa(consulta())).rejects.toThrow("NOT_FOUND");
    expect(datosEdicionIa).not.toHaveBeenCalled();
  });

  it("el título, el flujo de PI, los avisos fijos y el pie", async () => {
    const raiz = await pantalla(PaginaIa(consulta()));
    expect(texto(raiz.querySelector("h1"))).toBe(TEXTOS_IA.TITULO);
    expect(raiz.querySelector('nav[aria-label="Secciones"] a[aria-current="page"]')?.getAttribute("href")).toBe("/edicion");
    const todo = texto(raiz);
    expect(todo).toContain("Encender la nube tiene costo y envía a Anthropic los hechos ciegos (sin cifras, especies ni cuentas)");
    expect(todo).toContain("En producción, el servidor solo puede llegar a la dirección y al puerto del Mac que autorizó PI. Cualquier otra dirección queda bloqueada por el firewall y la prueba falla");
    expect(todo).toContain("con más de 0, el mismo dato puede dar textos distintos; el validador sigue revisando todo");
    expect(todo).toContain("recarga unos 20 GB en frío en cada corrida");
    expect(todo).toContain(AVISOS_IA.SONDA_PENDIENTE);
    expect(todo).toContain(PIE_EDICION);
    for (const f of FIJOS_IA) expect(todo).toContain(f.que);
  });

  it("el estado de cada puerta con sus requisitos; «por verificar» se dice así", async () => {
    const raiz = await pantalla(PaginaIa(consulta()));
    const estado = raiz.querySelector('[aria-labelledby="t-puertas"]');
    expect(texto(estado)).toContain(mensajeIa("SIN_DESTINO"));
    expect(texto(estado)).toContain("Por verificar");
    expect(texto(estado)).not.toMatch(/\bLista para usar\b/);
  });

  it("el gasto frente al tope, la llave solo como sí/no y la historia", async () => {
    const raiz = await pantalla(PaginaIa(consulta()));
    const todo = texto(raiz);
    expect(todo).toContain("USD 0,13 de USD 4,61");
    expect(todo).toContain("Llave de la nube en el entorno de la app: no");
    expect(texto(raiz.querySelector('[aria-labelledby="t-historia"]'))).toContain("Cambio ficticio");
  });

  it("con ?guardada=N avisa que se guardó (solo un número; otra cosa no se pinta)", async () => {
    datosEdicionIa.mockResolvedValue({ ...DATOS, guardada: 8 });
    expect(texto(await pantalla(PaginaIa(consulta({ guardada: "8" }))))).toContain("Se guardó la versión 8");
    expect(datosEdicionIa).toHaveBeenLastCalledWith({ soy: "la base" }, expect.anything(), "8");
  });

  it("sin base: el aviso de siempre", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { Prisma } = await import("@prisma/client");
    datosEdicionIa.mockRejectedValue(new Prisma.PrismaClientInitializationError("sin base ficticia", "5.22.0"));
    expect(texto(await pantalla(PaginaIa(consulta())))).toContain("No se pudo leer la base de 008");
  });
});

describe("textos de /edicion/ia", () => {
  it("cada código que puede mandar el servidor tiene su mensaje (ninguno cae en el genérico)", () => {
    for (const c of CODIGOS_CON_MENSAJE) expect(mensajeIa(c), c).not.toBe(mensajeIa("CODIGO_QUE_NO_EXISTE"));
  });

  it("ningún texto recomienda comprar o vender", () => {
    const todos = JSON.stringify({ AVISOS_IA, FIJOS_IA, TEXTOS_IA, mensajes: CODIGOS_CON_MENSAJE.map(mensajeIa) }).toLowerCase();
    expect(todos).not.toMatch(/\b(compre|venda|comprar|vender|recomendamos)\b/);
  });

  it("los avisos no traen una IPv4 escrita", () => {
    expect(JSON.stringify({ AVISOS_IA, TEXTOS_IA })).not.toMatch(/(?<![\d.])\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?![\d.])/);
  });
});
