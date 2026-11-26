// @vitest-environment jsdom
// Pantalla /conciliacion (PR-C, GATE 1 aprobada) con la lectura simulada: se arma por el camino real
// (página → datos → vista → componente, render del servidor) y se lee como la lee una persona.
// - exige sesión antes de leer; la base caída muestra «No se pudo leer la base» y registra solo el código;
// - el corte del query se acepta solo si es uno de los cargados (sin eco de lo escrito);
// - textos claros para el dueño, sin comandos ni recomendaciones.
// Datos inventados (tests/unit/conciliacion/ficticio.ts).
import { Prisma } from "@prisma/client";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MOTIVOS } from "@/app/conciliacion/motivos";
import { CORTES, D, LECTURA } from "./ficticio";

const exigirSesion = vi.hoisted(() => vi.fn());
const cortesDisponibles = vi.hoisted(() => vi.fn());
const leerConciliacion = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirSesion }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/conciliacion/leer", () => ({ cortesDisponibles, leerConciliacion }));
const procedenciasDeLaLectura = vi.hoisted(() => vi.fn());
vi.mock("@/app/conciliacion/procedencias", async (original) => ({ ...(await original<typeof import("@/app/conciliacion/procedencias")>()), procedenciasDeLaLectura }));

import Pagina from "@/app/conciliacion/page";

type Consulta = Record<string, string | string[] | undefined>;
let registro: ReturnType<typeof vi.spyOn>;

async function pantalla(consulta: Consulta = {}): Promise<HTMLElement> {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve(consulta) }));
  return raiz;
}
const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const fila = (raiz: HTMLElement, primera: string) => [...raiz.querySelectorAll("tr")].find((tr) => texto(tr.querySelector("th, td")) === primera);

beforeEach(() => {
  exigirSesion.mockResolvedValue({ id: "u1", email: "dueno@ejemplo.invalid", rol: "DUENO" });
  cortesDisponibles.mockResolvedValue(CORTES);
  leerConciliacion.mockResolvedValue(LECTURA);
  procedenciasDeLaLectura.mockResolvedValue({ cierres: new Map(), fondos: new Map() });
  registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  registro.mockRestore();
  exigirSesion.mockReset();
  cortesDisponibles.mockReset();
  leerConciliacion.mockReset();
  procedenciasDeLaLectura.mockReset();
});

describe("src/app/conciliacion/page.tsx · sesión y base", () => {
  it("sin sesión no lee la base: la redirección de exigirSesion se propaga", async () => {
    const redireccion = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/ingresar;307;" });
    exigirSesion.mockRejectedValueOnce(redireccion);
    await expect(Pagina({ searchParams: Promise.resolve({}) })).rejects.toBe(redireccion);
    expect(cortesDisponibles).not.toHaveBeenCalled();
    expect(leerConciliacion).not.toHaveBeenCalled();
  });

  it("con la base caída muestra «No se pudo leer la base» y registra solo el código, nunca el mensaje", async () => {
    cortesDisponibles.mockRejectedValueOnce(new Prisma.PrismaClientInitializationError("Can't reach postgresql://usuario:clave@host-privado:5438", "5.22.0", "P1001"));
    const raiz = await pantalla();
    expect(texto(raiz.querySelector("h1"))).toBe("No se pudo leer la base de Inversiones");
    expect(registro).toHaveBeenCalledTimes(1);
    expect(registro).toHaveBeenCalledWith("[conciliacion] no se pudo leer la base (código: P1001)");
    // react-reviewer BAJO: la pantalla de base caída la ve el dueño: sin comandos.
    expect(raiz.innerHTML).not.toMatch(/npm|npx|prisma|db:up/);
    expect(texto(raiz)).toContain("avise a quien administra el sistema");
  });

  it("un error que no es de la base se propaga (lo atiende error.tsx)", async () => {
    leerConciliacion.mockRejectedValueOnce(new Error("fallo de cálculo ficticio"));
    await expect(Pagina({ searchParams: Promise.resolve({}) })).rejects.toThrow("fallo de cálculo ficticio");
    expect(registro).not.toHaveBeenCalled();
  });
});

describe("src/app/conciliacion/page.tsx · qué corte se muestra", () => {
  it("sin corte en la dirección muestra el más reciente, con la fecha que vino de la base", async () => {
    await pantalla();
    expect(leerConciliacion).toHaveBeenCalledTimes(1);
    expect(leerConciliacion.mock.calls[0]![1]).toBe(CORTES[0]!.fechaCorte);
  });

  it("con un corte cargado muestra ese", async () => {
    await pantalla({ corte: "2024-11-14" });
    expect(leerConciliacion.mock.calls[0]![1]).toBe(CORTES[1]!.fechaCorte);
  });

  it.each<Consulta>([{ corte: "2024-11-15" }, { corte: "2024-13-99" }, { corte: "<script>alert(1)</script>" }, { corte: "" }, { corte: ["2024-11-22", "2024-11-14"] }])(
    "un corte que no está entre los cargados (%o) da un aviso sin repetirlo y ofrece los cortes; no lee la conciliación",
    async (consulta) => {
      const raiz = await pantalla(consulta);
      expect(texto(raiz.querySelector("h1"))).toBe("No hay certificación con esa fecha de corte");
      expect(raiz.innerHTML).not.toContain("script");
      expect(raiz.innerHTML).not.toContain("2024-11-15");
      expect(raiz.querySelectorAll('nav a[href^="/conciliacion?corte="]')).toHaveLength(2);
      expect(leerConciliacion).not.toHaveBeenCalled();
    },
  );

  it("sin ninguna certificación cargada lo dice, sin selector", async () => {
    cortesDisponibles.mockResolvedValueOnce([]);
    const raiz = await pantalla();
    expect(texto(raiz.querySelector("h1"))).toBe("Todavía no hay certificación de A&V");
    expect(raiz.querySelector("nav[aria-labelledby]")).toBeNull();
    expect(leerConciliacion).not.toHaveBeenCalled();
  });

  it("si la certificación desaparece entre las dos lecturas, da el mismo aviso", async () => {
    leerConciliacion.mockResolvedValueOnce(null);
    expect(texto((await pantalla()).querySelector("h1"))).toBe("No hay certificación con esa fecha de corte");
  });

  it("certificación cargada sin conciliar: lo dice y muestra lo que está por liquidar", async () => {
    leerConciliacion.mockResolvedValueOnce({ ...LECTURA, conciliacion: null, frescura: null });
    const raiz = await pantalla();
    expect(texto(raiz.querySelector("h1"))).toBe("Corte del 22-nov-2024: sin conciliar");
    expect(texto(raiz)).toContain("La certificación de este corte está cargada, pero todavía no se ha conciliado.");
    expect(raiz.querySelector("table[aria-labelledby='t-acciones']")).toBeNull();
    expect(fila(raiz, "FICTB")).toBeDefined();
  });
});

describe("src/app/conciliacion/page.tsx · la conciliación", () => {
  it("arriba: el corte y el resultado, cuándo se calculó, las cuentas y que está al día", async () => {
    const raiz = await pantalla();
    expect(texto(raiz.querySelector("h1"))).toBe("Corte del 22-nov-2024: No cuadra");
    const todo = texto(raiz);
    expect(todo).toContain("Calculada el 22-nov-2024 a las 22:05 (hora de Colombia).");
    expect(todo).toContain("3 cuadran · 2 no cuadran · 0 por liquidar · 3 no se pudieron verificar");
    expect(todo).toContain("Está al día con los datos que hay hoy en el sistema.");
  });

  it("una fila por especie con cantidad y valor de A&V frente al sistema, su resultado y el porqué", async () => {
    const raiz = await pantalla();
    const tabla = raiz.querySelector("table[aria-labelledby='t-acciones']")!;
    const encabezados = [...tabla.querySelectorAll("thead th")].map(texto);
    expect(encabezados).toEqual(["Especie", "Cantidad A&V", "Cantidad sistema", "Diferencia", "Valor A&V", "Valor sistema", "Diferencia %", "Resultado", "Por qué"]);
    expect([...fila(raiz, "FICTA")!.querySelectorAll("th, td")].map(texto)).toEqual(["FICTA", "100", "100", "0", "$ 110.000", "$ 110.000", "0,00 %", "Cuadra", ""]);
    const c = [...fila(raiz, "FICTC")!.querySelectorAll("th, td")].map(texto);
    expect(c.slice(5)).toEqual(["—", "—", "No se pudo verificar", MOTIVOS.sin_precio_al_corte]);
    expect(texto(fila(raiz, "FICTI"))).toContain(MOTIVOS.no_certificada);
    expect(texto(fila(raiz, "Total de acciones"))).toContain("No se pudo verificar");
  });

  it("filas para el fondo (por su nombre) y el efectivo, con la diferencia con signo", async () => {
    const raiz = await pantalla();
    expect([...fila(raiz, "Fondo ficticio uno")!.querySelectorAll("th, td")].map(texto)).toEqual([
      "Fondo ficticio uno", "$ 6.250.000", "—", "—", "—", "No se pudo verificar", MOTIVOS.fondo_sin_unidades,
    ]);
    expect([...fila(raiz, "Efectivo")!.querySelectorAll("th, td")].map(texto)).toEqual(["Efectivo", "$ 1.000", "$ 250", "+$ 750", "+75,00 %", "No cuadra", MOTIVOS.partida_sin_fuente]);
  });

  it("lo que está por liquidar, con el rótulo de que se lee de las órdenes de hoy", async () => {
    const raiz = await pantalla();
    expect(texto(raiz)).toContain("según las órdenes que hay hoy en el sistema");
    expect([...fila(raiz, "FICTB")!.querySelectorAll("th, td")].map(texto)).toEqual(["FICTB", "Venta", "20", "21-nov-2024", "25-nov-2024"]);
    leerConciliacion.mockResolvedValueOnce({ ...LECTURA, porLiquidar: [] });
    expect(texto(await pantalla())).toContain("No hay operaciones por liquidar al corte.");
  });

  it("desactualizada o sin poder comprobarlo: un aviso visible (role=status) y se muestra igual lo guardado", async () => {
    leerConciliacion.mockResolvedValueOnce({ ...LECTURA, frescura: "DESACTUALIZADA" });
    let raiz = await pantalla();
    expect(texto(raiz.querySelector("[role=status]"))).toBe("Los datos del sistema cambiaron después de este cálculo: el resultado puede no estar al día. Hay que volver a conciliar este corte.");
    expect(fila(raiz, "FICTA")).toBeDefined();
    leerConciliacion.mockResolvedValueOnce({ ...LECTURA, frescura: "NO_SE_PUDO_COMPROBAR" });
    raiz = await pantalla();
    expect(texto(raiz.querySelector("[role=status]"))).toBe("No se pudo comprobar si está al día. Se muestra lo que se calculó.");
    expect(fila(raiz, "FICTA")).toBeDefined();
  });

  it("el selector de cortes: un enlace por corte con su resultado, y el que se ve marcado", async () => {
    const raiz = await pantalla({ corte: "2024-11-22" });
    const enlaces = [...raiz.querySelectorAll("nav a")].filter((a) => a.getAttribute("href")?.startsWith("/conciliacion?corte="));
    expect(enlaces.map((a) => [a.getAttribute("href"), texto(a), a.getAttribute("aria-current")])).toEqual([
      ["/conciliacion?corte=2024-11-22", "22-nov-2024 · No cuadra", "page"],
      ["/conciliacion?corte=2024-11-14", "14-nov-2024 · Cuadra, con operaciones por liquidar", null],
    ]);
    expect(raiz.querySelector('a[href="/"]')).not.toBeNull();
  });

  it("sin comandos ni jerga en la pantalla, y nunca recomienda comprar ni vender", async () => {
    for (const lectura of [LECTURA, { ...LECTURA, frescura: "DESACTUALIZADA" as const }, { ...LECTURA, conciliacion: null, frescura: null }]) {
      leerConciliacion.mockResolvedValueOnce(lectura);
      const html = (await pantalla()).innerHTML;
      expect(html).not.toMatch(/npm|npx|tsx|scripts\/|--fecha|conciliar-certificacion|precios:actualizar/);
      expect(html).not.toMatch(/\b(compre|compren|venda|vendan|recomendamos)\b/i);
      expect(html).toContain("no recomienda comprar ni vender");
    }
  });
});

describe("src/app/conciliacion/page.tsx · revisión (react-reviewer)", () => {
  it("cada tabla va en una caja desplazable con nombre, que el teclado puede enfocar (en el teléfono se desplaza)", async () => {
    const raiz = await pantalla();
    const tablas = [...raiz.querySelectorAll("table")];
    expect(tablas).toHaveLength(3);
    for (const tabla of tablas) {
      const caja = tabla.parentElement!;
      expect(caja.getAttribute("role"), tabla.getAttribute("aria-labelledby")!).toBe("region");
      expect(caja.getAttribute("tabindex")).toBe("0");
      expect(caja.getAttribute("aria-labelledby")).toBe(tabla.getAttribute("aria-labelledby"));
    }
  });

  it("sin jerga: «comprobaciones» en vez de «controles» y el pie sin «base local»", async () => {
    const raro = { tipo: "PRECIO", instrumentoId: "a", esperado: null, real: null, diferencia: null, tolerancia: null, resultado: "CUADRA", codigoMotivo: null, detalle: null, instrumento: null };
    leerConciliacion.mockResolvedValueOnce({ ...LECTURA, conciliacion: { ...LECTURA.conciliacion!, controles: [...LECTURA.conciliacion!.controles, raro] } });
    const todo = texto(await pantalla());
    expect(todo).toContain("Hay 1 comprobación que esta pantalla todavía no sabe mostrar.");
    expect(todo).toContain("Datos guardados en este sistema.");
    expect(todo).not.toMatch(/\bcontrol(es)?\b|base local/);
  });
});

describe("candados de src/app/conciliacion", () => {
  // Rutas por texto (no `new URL`): en jsdom, URL es la del navegador simulado y node:fs no la acepta.
  const carpeta = resolve(dirname(fileURLToPath(import.meta.url)), "../../../src/app/conciliacion");
  const archivos = readdirSync(carpeta).filter((a) => /\.tsx?$/.test(a));

  it("encuentra la página y su componente (si no, no probaría nada)", () => {
    expect(archivos).toEqual(expect.arrayContaining(["page.tsx", "Conciliacion.tsx"]));
  });

  it("todo es del servidor: sin «use client» ni HTML crudo", () => {
    for (const a of archivos) {
      const fuente = readFileSync(join(carpeta, a), "utf8");
      expect(fuente, a).not.toMatch(/["']use client["']/);
      expect(fuente, a).not.toContain("dangerouslySetInnerHTML");
    }
  });
});

describe("src/app/conciliacion/page.tsx · de dónde y de cuándo es cada «Valor sistema» (frente fecha-hora-datos)", () => {
  // Con el total y el fondo calculados (en la lectura de siempre no lo están: sin precio y sin unidades).
  const calculada = {
    ...LECTURA,
    conciliacion: {
      ...LECTURA.conciliacion!,
      controles: LECTURA.conciliacion!.controles.map((c) =>
        c.tipo === "FONDO" ? { ...c, esperado: D("6250000"), diferencia: D("0"), resultado: "CUADRA" as const, codigoMotivo: null }
          : c.tipo === "VALOR" && c.instrumentoId === null ? { ...c, esperado: D("115050"), diferencia: D("0"), resultado: "CUADRA" as const, codigoMotivo: null } : c),
    },
  };
  const procedencias = {
    cierres: new Map([["a", { fuente: "yahoo", traidoEn: new Date("2027-01-13T23:41:00Z") }]]),
    fondos: new Map([["f", { fuente: "sfc:qhpu-8ixx", traidoEn: new Date("2027-01-14T12:07:00Z") }]]),
  };
  // La línea visible de cada nota (el detalle accesible tiene su propia clase).
  const notas = (tr: Element | undefined) => [...(tr?.querySelectorAll(".fecha-dato-linea") ?? [])].map(texto);

  beforeEach(() => {
    leerConciliacion.mockResolvedValue(calculada);
    procedenciasDeLaLectura.mockResolvedValue(procedencias);
  });

  it("lee las procedencias de la conciliación que muestra", async () => {
    await pantalla();
    expect(procedenciasDeLaLectura).toHaveBeenCalledWith({}, calculada);
  });

  it("cada especie: el cierre del corte, cuándo lo trajo 008 (hora de Colombia) y la fuente, en su «Valor sistema»", async () => {
    const raiz = await pantalla();
    const celdas = [...fila(raiz, "FICTA")!.querySelectorAll("th, td")];
    expect(notas(celdas[5])).toEqual(["Cierre 22-nov-2024 · Yahoo (BVC) · traído 13-ene-2027 18:41"]);
    expect(texto(celdas[5])).toMatch(/^\$ 110\.000Cierre 22-nov-2024/);
    expect(notas(fila(raiz, "FICTC"))).toEqual([]);
  });

  it("el total de acciones, con el cierre más viejo que lo compone; el fondo, con su valor de unidad", async () => {
    const raiz = await pantalla();
    expect(notas(fila(raiz, "Total de acciones"))).toEqual(["Cierre 22-nov-2024 · Yahoo (BVC) · traído 13-ene-2027 18:41"]);
    expect(notas(fila(raiz, "Fondo ficticio uno"))).toEqual(["Valor de unidad 22-nov-2024 · SFC · traído 14-ene-2027 07:07"]);
    expect(notas(fila(raiz, "Efectivo"))).toEqual([]);
  });

  it("sin conciliar no hay valores del sistema ni procedencias", async () => {
    leerConciliacion.mockResolvedValueOnce({ ...LECTURA, conciliacion: null, frescura: null });
    expect((await pantalla()).querySelector(".fecha-dato")).toBeNull();
  });
});
