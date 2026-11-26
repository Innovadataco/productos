// @vitest-environment jsdom
// La pantalla /datos-oficiales pintada en el servidor (frente datos-oficiales-pantalla, C6a), con vistas inventadas:
// una tarjeta por serie con su último valor, su vigencia (y «Vale hoy» solo si cubre hoy), su frescura en texto (no
// solo en color), la fuente con enlace https a un host de la lista (sin target, sin referer), cuándo se trajo y cómo
// entra; en el IPC, la variación «calculada por Inversiones». Sin datos y con error, ninguna cifra. Sin formularios ni botones.
// Revisión a11y-architect (MEDIO): la insignia dice, para el lector, que es el estado de la serie, y el enlace dice
// adónde lleva (la página oficial de esa serie, en un sitio externo), sin cambiar el texto visible.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DatosOficiales } from "@/app/datos-oficiales/DatosOficiales";
import { enlaceSeguro } from "@/app/datos-oficiales/fuentes";
import { tituloGrafica } from "@/app/datos-oficiales/formato";
import type { SerieVista } from "@/app/datos-oficiales/tipos";
import { IBR, IPC, TPM, TRM, conError, datos, sinDatos } from "./ficticio";

const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

function pantalla(series?: readonly SerieVista[], soloLectura?: boolean): HTMLElement {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(createElement(DatosOficiales, { datos: datos(series), soloLectura }));
  return raiz;
}

const tarjeta = (raiz: HTMLElement, nombre: string): HTMLElement => {
  const t = [...raiz.querySelectorAll<HTMLElement>("article")].find((a) => texto(raiz.querySelector(`#${a.getAttribute("aria-labelledby")}`)) === nombre);
  if (!t) throw new Error(`No hay tarjeta «${nombre}»`);
  return t;
};

/** El texto visible del estado (la insignia lleva además «Estado de la serie: » para el lector de pantalla). */
const estadoVisible = (t: HTMLElement) => texto(t.querySelector(".do-estado .do-estado-texto"));
const externo = (nombre: string) => `(página oficial de ${nombre}, sitio externo)`;

/** Los pares de la lista de datos de una tarjeta: [término, descripción]. */
const pares = (t: HTMLElement) => [...t.querySelectorAll("dl dt")].map((dt) => [texto(dt), texto(dt.nextElementSibling)]);

describe("la pantalla", () => {
  it("el encabezado con «Datos oficiales» como actual, el título, el día de la consulta y el pie", () => {
    const raiz = pantalla();
    const actual = raiz.querySelector('header nav[aria-label="Secciones"] a[aria-current="page"]');
    expect([texto(actual), actual?.getAttribute("href")]).toEqual(["Datos oficiales", "/datos-oficiales"]);
    expect(texto(raiz.querySelector("h1"))).toBe("Datos oficiales");
    expect(texto(raiz.querySelector(".do-hero .eyebrow"))).toBe("Consultado el 17-mar-2021 (hora de Colombia)");
    expect(texto(raiz.querySelector("footer.pie"))).toBe("Inversiones informa; no recomienda comprar ni vender.");
  });

  it("la marca «Solo lectura» con un familiar; con el dueño, no", () => {
    expect(texto(pantalla(undefined, true).querySelector("header .solo-lectura"))).toBe("Solo lectura");
    expect(pantalla(undefined, false).querySelector("header .solo-lectura")).toBeNull();
  });

  it("cuatro tarjetas con su nombre como título, en el orden del catálogo, y una gráfica cada una", () => {
    const raiz = pantalla();
    expect([...raiz.querySelectorAll("article h2")].map(texto)).toEqual([TRM.nombre, TPM.nombre, IBR.nombre, IPC.nombre]);
    expect([...raiz.querySelectorAll("article figure")].map((f) => texto(raiz.querySelector(`#${f.getAttribute("aria-labelledby")}`)))).toEqual(
      [TRM, TPM, IBR, IPC].map(tituloGrafica),
    );
  });

  it("no trae formularios, botones ni campos (la familia la ve en solo lectura y la pantalla no escribe)", () => {
    expect(pantalla().querySelectorAll("form, button, input, select, textarea")).toHaveLength(0);
  });
});

describe("cada tarjeta", () => {
  it("TRM al día y vigente hoy: cifra, unidad, «Vale hoy», fuente, carga y cómo entra", () => {
    const t = tarjeta(pantalla(), TRM.nombre);
    expect(estadoVisible(t)).toBe("Al día");
    expect(texto(t.querySelector(".do-cifra"))).toBe("3.923,07");
    expect(texto(t.querySelector(".do-unidad"))).toBe("COP por USD");
    expect(texto(t.querySelector(".do-vigencia"))).toBe("Vale hoy · vigente el 17-mar-2021");
    expect(pares(t)).toEqual([
      ["Fuente", `${TRM.origen} ${externo(TRM.nombre)} sfc:32sa-8pi3`],
      ["Traído el", "16-mar-2021 a las 18:41 (hora de Colombia)"],
      ["Cómo entra", "A mano: la carga el dueño (vía B)"],
      ["Frescura", "Su vigencia todavía corre."],
    ]);
  });

  it("la insignia, para el lector de pantalla, dice que es el estado de la serie; lo visible no cambia", () => {
    const t = tarjeta(pantalla(), IBR.nombre);
    expect(texto(t.querySelector(".do-estado"))).toBe("Estado de la serie: Atrasada");
    expect(texto(t.querySelector(".do-estado .sr"))).toBe("Estado de la serie:");
  });

  it("TPM al día pero de ayer: nunca dice «Vale hoy»", () => {
    const t = tarjeta(pantalla(), TPM.nombre);
    expect(estadoVisible(t)).toBe("Al día");
    expect(texto(t.querySelector(".do-vigencia"))).toBe("No es la cifra de hoy · vigente el 16-mar-2021");
    expect(texto(t)).not.toContain("Vale hoy");
  });

  it("IBR atrasada: lo dice en texto, con hace cuánto terminó", () => {
    const t = tarjeta(pantalla(), IBR.nombre);
    expect(estadoVisible(t)).toBe("Atrasada");
    expect(t.querySelector(".do-estado")?.getAttribute("data-estado")).toBe("ATRASADA");
    expect(pares(t).at(-1)).toEqual(["Frescura", "Terminó hace 12 días; se marca atrasada desde 7 días."]);
  });

  it("IPC: el mes que corresponde y la variación en 12 meses «calculada por Inversiones»", () => {
    const t = tarjeta(pantalla(), IPC.nombre);
    expect(texto(t.querySelector(".do-vigencia"))).toBe("No es la cifra de hoy · corresponde a feb-2021");
    expect(texto(t.querySelector(".do-variacion"))).toBe("Variación en 12 meses +2,71 % de variación (calculada por Inversiones)");
    expect(texto(t.querySelector(".do-variacion-nota"))).toBe("Entre feb-2020 y feb-2021, con el índice de cada mes.");
  });

  it("IPC sin el índice del año anterior o sin poder calcular: lo dice, sin cifra de variación", () => {
    const sinBase = tarjeta(pantalla([{ ...IPC, variacion: { estado: "SIN_BASE", mesBase: "2020-02-01" } }]), IPC.nombre);
    expect(texto(sinBase.querySelector(".do-variacion"))).toBe("Variación en 12 meses: falta el índice de feb-2020 (el mismo mes del año anterior): no se calcula.");
    const noSePudo = tarjeta(pantalla([{ ...IPC, variacion: { estado: "NO_SE_PUDO" } }]), IPC.nombre);
    expect(texto(noSePudo.querySelector(".do-variacion"))).toBe("Variación en 12 meses: no se pudo calcular con los índices guardados.");
    expect(noSePudo.querySelector(".do-variacion .do-cifra-chica")).toBeNull();
  });

  it("las series que no son índice no traen variación", () => {
    const raiz = pantalla();
    for (const s of [TRM, TPM, IBR]) expect(tarjeta(raiz, s.nombre).querySelector(".do-variacion")).toBeNull();
  });

  it("sin datos y con error: ninguna cifra ni gráfica; la fuente y cómo entra, sí", () => {
    const raiz = pantalla([sinDatos("TRM"), conError("TPM")]);
    const sin = tarjeta(raiz, TRM.nombre);
    expect(estadoVisible(sin)).toBe("Sin datos");
    expect(texto(sin.querySelector(".do-mensaje"))).toBe("Todavía no hay ningún valor cargado de esta serie.");
    const error = tarjeta(raiz, TPM.nombre);
    expect(estadoVisible(error)).toBe("No se pudo leer");
    expect(texto(error.querySelector(".do-mensaje"))).toBe("No se pudo leer esta serie; las demás sí. Quedó registrado para revisarlo.");
    for (const t of [sin, error]) {
      expect(t.querySelector(".do-cifra, .do-vigencia, figure")).toBeNull();
      expect(pares(t).map(([dt]) => dt)).toEqual(["Fuente", "Cómo entra"]);
    }
  });

  it("con menos de dos valores en la ventana, una nota en lugar de la gráfica", () => {
    const t = tarjeta(pantalla([{ ...TRM, historia: TRM.historia.slice(-1) }]), TRM.nombre);
    expect(t.querySelector("figure")).toBeNull();
    expect(texto(t.querySelector(".do-sin-grafica"))).toBe("Solo hay un valor en el último año: la gráfica aparece con dos o más.");
  });
});

describe("los enlaces", () => {
  it("cada fuente enlaza a su página oficial en https, sin target y sin mandar la página de origen", () => {
    const enlaces = [...pantalla([TRM, TPM, IBR, IPC, sinDatos("IBR_3M_EA")]).querySelectorAll("main a")];
    expect(enlaces).toHaveLength(5);
    for (const a of enlaces) {
      const href = a.getAttribute("href") ?? "";
      expect(enlaceSeguro(href), href).toBe(href);
      expect((a.getAttribute("rel") ?? "").split(" ").sort(), href).toEqual(["noopener", "noreferrer"]);
      expect(a.getAttribute("referrerpolicy"), href).toBe("no-referrer");
      expect(a.hasAttribute("target"), href).toBe(false);
    }
  });

  it("cada enlace dice adónde lleva (para el lector): la página oficial de esa serie, en un sitio externo", () => {
    const raiz = pantalla();
    for (const s of [TRM, TPM, IBR, IPC]) {
      const a = tarjeta(raiz, s.nombre).querySelector("a")!;
      expect(texto(a), s.codigo).toBe(`${s.origen} ${externo(s.nombre)}`);
      expect(texto(a.querySelector(".sr")), s.codigo).toBe(externo(s.nombre));
    }
  });

  it("una fuente que no está en la lista queda como texto, sin enlace", () => {
    const rara = { ...TRM, ultimo: { ...TRM.ultimo, fuente: "sfc:otra" } };
    const t = tarjeta(pantalla([rara]), TRM.nombre);
    expect(t.querySelector("a")).toBeNull();
    expect(pares(t)[0]).toEqual(["Fuente", `${TRM.origen} sfc:otra`]);
  });
});
