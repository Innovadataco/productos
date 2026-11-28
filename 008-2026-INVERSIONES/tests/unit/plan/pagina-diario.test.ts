// @vitest-environment jsdom
// Pantalla /decisiones, el diario (fase B, corte 3), con la lectura simulada: página → datos → vista → componente.
// Exige sesión antes de leer; ?regla= solo si es una regla de la base (sin eco); el resultado a 30 y 90 días con
// dividendos, cada uno enlazado a su cadena; las órdenes sin decisión registrada aparte. Mide; no recomienda.
// Datos inventados (tests/unit/plan/ficticio-pantallas.ts).
import { Prisma } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AHORA, DIARIO } from "./ficticio-pantallas";

const exigirSesion = vi.hoisted(() => vi.fn());
const leerDiario = vi.hoisted(() => vi.fn());
const reglaPorId = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirSesion }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/plan/lectura", () => ({ leerDiario, reglaPorId, TOPE_DIARIO: 500 }));

import Pagina from "@/app/decisiones/page";

type Consulta = Record<string, string | string[] | undefined>;
let registro: ReturnType<typeof vi.spyOn>;

async function pantalla(consulta: Consulta = {}): Promise<HTMLElement> {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve(consulta) }));
  return raiz;
}
const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const decision = (raiz: HTMLElement, id: string) => raiz.querySelector(`#decision-${id}`);
const celdas = (tr: Element | null) => [...(tr?.querySelectorAll("th, td") ?? [])].map(texto);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
  exigirSesion.mockResolvedValue({ id: "u1", email: "dueno@ejemplo.invalid", rol: "DUENO" });
  leerDiario.mockResolvedValue(DIARIO);
  reglaPorId.mockResolvedValue(null);
  registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  registro.mockRestore();
  for (const f of [exigirSesion, leerDiario, reglaPorId]) f.mockReset();
});

describe("src/app/decisiones/page.tsx · sesión y base", () => {
  it("sin sesión no lee la base", async () => {
    const redireccion = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/ingresar;307;" });
    exigirSesion.mockRejectedValueOnce(redireccion);
    await expect(Pagina({ searchParams: Promise.resolve({}) })).rejects.toBe(redireccion);
    expect(leerDiario).not.toHaveBeenCalled();
  });

  it("con la base caída muestra «No se pudo leer la base» y registra solo el código", async () => {
    leerDiario.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("detalle con datos", { code: "P2024", clientVersion: "5.22.0" }));
    const raiz = await pantalla();
    expect(texto(raiz.querySelector("h1"))).toBe("No se pudo leer la base de Inversiones");
    expect(registro).toHaveBeenCalledWith("[decisiones] no se pudo leer la base (código: P2024)");
  });

  it("lee con la fecha de hoy en Colombia y sin filtro", async () => {
    await pantalla();
    expect(leerDiario).toHaveBeenCalledWith(expect.anything(), new Date("2024-11-25T00:00:00.000Z"), null);
  });
});

describe("el diario", () => {
  it("resume por horizonte solo con conteos (las reemplazadas no cuentan)", async () => {
    const raiz = await pantalla();
    expect(texto(raiz.querySelector("h1"))).toBe("Diario de decisiones");
    const resumen = [...raiz.querySelectorAll(".resumen-horizonte")].map(texto);
    expect(resumen).toEqual([
      "A 30 días: 1 funcionó · 1 no funcionó · 1 sin veredicto · 1 pendiente · 1 sin precio · 1 sin orden enlazada",
      "A 90 días: 1 funcionó · 1 no funcionó · 1 sin veredicto · 2 pendientes · 1 sin orden enlazada",
    ]);
  });

  it("columnas, y «no actuar» con el dividendo dentro del resultado a 90 días", async () => {
    const raiz = await pantalla();
    expect([...raiz.querySelectorAll("table")[0]!.querySelectorAll("thead th")].map(texto)).toEqual(["Fecha", "Especie", "Decidió", "Cantidad", "Regla", "Motivo", "Órdenes", "A 30 días", "A 90 días"]);
    const c = celdas(decision(raiz, "d-noact"));
    expect(c.slice(0, 7)).toEqual(["22-jul-2024", "FICTA", "No actuar (excepción a la regla)", "43", "v1 · Cierre por encima de $ 1.200 → vender", "Mantener hasta el dividendo de octubre (ficticio)", "—"]);
    expect(c[7]).toContain("Funcionó · +$ 1.548");
    expect(c[7]).toContain("precio +$ 1.548 · dividendos $ 0");
    expect(c[8]).toContain("Funcionó · +$ 5.246");
    expect(c[8]).toContain("precio +$ 4.730 · dividendos +$ 516");
    expect(c[8]).toContain("cierres sin verificar con A&V");
  });

  it("cada resultado lleva a la cadena de su decisión; la regla, a su fila del plan", async () => {
    const fila = decision(await pantalla(), "d-noact")!;
    const enlaces = [...fila.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(enlaces).toEqual(["/plan?version=1#regla-r-a", "/decisiones/d-noact", "/decisiones/d-noact"]);
  });

  it("sin precio, pendiente, sin orden, sin dividendos medibles y escisión en la ventana", async () => {
    const raiz = await pantalla();
    expect(celdas(decision(raiz, "d-vende")).slice(6)).toEqual(["1", "Sin precio: falta un cierre de Yahoo entre el 6-oct-2024 y el 13-oct-2024", "Pendiente hasta el 12-dic-2024"]);
    expect(celdas(decision(raiz, "d-pend"))[7]).toBe("Pendiente hasta el 22-dic-2024");
    expect(celdas(decision(raiz, "d-corr")).slice(7)).toEqual(["Sin orden enlazada", "Sin orden enlazada"]);
    const tenencia = celdas(decision(raiz, "d-tenencia"))[7]!;
    expect(tenencia).toContain("No funcionó · −$ 500");
    expect(tenencia).toContain("solo precio, sin dividendos: no quedaron acciones en la ventana para saber qué pagó la especie");
    const escision = celdas(decision(raiz, "d-escision"))[7]!;
    expect(escision).toContain("Sin veredicto · −$ 100");
    expect(escision).toContain("hubo una escisión de la especie en la ventana");
  });

  it("una decisión corregida queda como historia, sin resultado, y lleva a la corrección", async () => {
    const raiz = await pantalla();
    const vieja = decision(raiz, "d-vieja")!;
    expect(texto(vieja)).toContain("Corregida: ver la corrección");
    expect(vieja.querySelector("a[href='/decisiones/d-corr']")).not.toBeNull();
    expect(texto(decision(raiz, "d-corr"))).toContain("corrige la del 1-oct-2024");
  });

  it("las órdenes sin decisión registrada van aparte; las anteriores al plan, plegadas y sin alarma", async () => {
    const raiz = await pantalla();
    const tablas = [...raiz.querySelectorAll("table")];
    expect(texto(raiz)).toContain("Órdenes aprobadas de Trii desde que rige el plan (1-jul-2024) que todavía no están enlazadas a una decisión.");
    expect(celdas(tablas[1]!.querySelector("tbody tr"))).toEqual(["14-nov-2024", "FICTI", "Venta", "20", "fila 6 de la carga del 21-nov-2026"]);
    const plegadas = raiz.querySelector("details");
    expect(texto(plegadas?.querySelector("summary"))).toBe("4 órdenes anteriores al plan");
    expect(plegadas?.querySelectorAll("tbody tr")).toHaveLength(4);
  });

  it("sin decisiones lo dice; con más del tope, lo avisa", async () => {
    leerDiario.mockResolvedValueOnce({ ...DIARIO, decisiones: [], resultados: new Map() });
    expect(texto(await pantalla())).toContain("Todavía no hay decisiones registradas.");
    leerDiario.mockResolvedValueOnce({ ...DIARIO, truncado: true });
    expect(texto(await pantalla())).toContain("Se muestran las 500 decisiones más recientes.");
  });
});

describe("?regla= (desde la fila del plan)", () => {
  it("una regla de la base filtra el diario y lo dice", async () => {
    reglaPorId.mockResolvedValueOnce({ id: "r-a", version: 1, nemotecnico: "FICTA" });
    const raiz = await pantalla({ regla: "r-a" });
    expect(leerDiario).toHaveBeenCalledWith(expect.anything(), expect.any(Date), "r-a");
    expect(texto(raiz)).toContain("Decisiones que citan la regla de FICTA de la versión 1.");
    expect([...raiz.querySelectorAll("a")].find((a) => texto(a) === "Ver todas las decisiones")?.getAttribute("href")).toBe("/decisiones");
  });

  it("algo que no es una regla da un aviso, muestra todo y nunca repite lo escrito", async () => {
    for (const regla of ["no-existe", "<script>alert(1)</script>", "A B", ["r-a", "r-b"], "x".repeat(65)]) {
      reglaPorId.mockResolvedValue(null);
      leerDiario.mockClear();
      const raiz = await pantalla({ regla });
      expect(texto(raiz), String(regla)).toContain("No hay una regla con ese identificador; se muestran todas las decisiones.");
      expect(leerDiario).toHaveBeenCalledWith(expect.anything(), expect.any(Date), null);
      expect(raiz.innerHTML).not.toContain("script");
      expect(raiz.innerHTML).not.toContain("no-existe");
    }
  });
});

describe("sin recomendaciones", () => {
  it("el pie lo dice y ningún texto da órdenes de compra o venta", async () => {
    const raiz = await pantalla();
    expect(texto(raiz.querySelector("footer"))).toContain("El sistema mide decisiones pasadas; no recomienda comprar ni vender.");
    expect(texto(raiz)).not.toMatch(/\b(compre|venda|recomendamos|le recomendamos|debería)\b/i);
  });
});

describe("landmarks", () => {
  it("no hay dos regiones con el mismo nombre (una sección con nombre ya es una región)", async () => {
    const raiz = await pantalla();
    const nombre = (el: Element) => (el.getAttribute("aria-labelledby") ?? "").split(" ").map((id) => raiz.querySelector(`#${id}`)?.textContent ?? "").join(" ");
    const regiones = [...raiz.querySelectorAll('section[aria-labelledby], [role="region"]')].map(nombre);
    expect(regiones.length).toBeGreaterThan(0);
    expect(new Set(regiones).size, regiones.join(" | ")).toBe(regiones.length);
  });
});
