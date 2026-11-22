// @vitest-environment jsdom
// La sección de dividendos decretados de /datos-oficiales pintada en el servidor (frente datos-oficiales-decretos-pantalla,
// C6b), con vistas inventadas:
// - próximos ex-dividendos en una tabla: especie, decreto, valor por acción, fecha ex y de pago, tenencia, bruto ESTIMADO
//   (o «no se estima» con la tenencia negativa) y la referencia oficial con su versión;
// - el cruce con lo recibido de Trii en otra tabla, una fila por grupo (especie y fecha de pago): sus decretos, el bruto
//   esperado, el neto de Trii, la «diferencia bruto − neto» (nunca otro nombre), el estado en texto y por qué; el pago
//   en disputa, marcado a la vista;
// - la referencia oficial es enlace SOLO si es https a la SFC o a la BVC (la condición de C1); el radicado y lo demás,
//   texto. Sin target y sin mandar la página de origen;
// - cada tabla en una región con nombre que se desplaza con el teclado, encabezados con scope; estados vacíos en texto;
// - sin formularios ni botones (la familia la ve en solo lectura).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ESTADOS_CRUCE, MOTIVOS_REVISAR } from "@/datos-oficiales/decretos/cruce";
import { VENTANA_PAGO_ANTES_DIAS, VENTANA_PAGO_DESPUES_DIAS } from "@/datos-oficiales/decretos/ventana";
import { DatosOficiales } from "@/app/datos-oficiales/DatosOficiales";
import { EXPLICACION_ESTADO, TEXTO_ESTADO_CRUCE, TEXTO_MOTIVO } from "@/app/datos-oficiales/formato-decretos";
import { HOSTS_REFERENCIAS, enlaceSeguro } from "@/app/datos-oficiales/fuentes";
import type { DecretosVista } from "@/app/datos-oficiales/tipos";
import { datos } from "./ficticio";
import { CRUCE, DECRETOS, DECRETOS_VACIOS, EN_DISPUTA, PROXIMOS, RECIBIDO, SIN_DECRETO, TENENCIA_NEGATIVA, fila, proximo } from "./ficticio-decretos";

const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

function html(decretos: DecretosVista = DECRETOS): string {
  return renderToStaticMarkup(createElement(DatosOficiales, { datos: datos(undefined, decretos), soloLectura: true }));
}

function pantalla(decretos: DecretosVista = DECRETOS): HTMLElement {
  const raiz = document.createElement("div");
  raiz.innerHTML = html(decretos);
  return raiz;
}

const seccion = (raiz: HTMLElement): HTMLElement => {
  const s = raiz.querySelector<HTMLElement>('section[aria-labelledby="t-decretos"]');
  if (!s) throw new Error("No está la sección de decretos");
  return s;
};
const tabla = (raiz: HTMLElement, id: "t-proximos" | "t-cruce") => raiz.querySelector<HTMLTableElement>(`table[aria-labelledby="${id}"]`);
const encabezados = (t: HTMLTableElement | null) => [...(t?.querySelectorAll("thead th") ?? [])].map(texto);
const filas = (t: HTMLTableElement | null) => [...(t?.querySelectorAll("tbody tr") ?? [])];
const celdas = (tr: Element) => [...tr.children].map(texto);

describe("la sección de dividendos decretados", () => {
  it("va después de las series y antes del pie, con su título y sus dos tablas con nombre", () => {
    const raiz = pantalla();
    const s = seccion(raiz);
    expect(texto(s.querySelector("h2#t-decretos"))).toBe("Dividendos decretados");
    expect(s.previousElementSibling?.classList.contains("do-series")).toBe(true);
    expect(s.nextElementSibling?.matches("footer.pie")).toBe(true);
    expect(texto(s.querySelector("h3#t-proximos"))).toBe("Próximos ex-dividendos");
    expect(texto(s.querySelector("h3#t-cruce"))).toBe("Cruce con lo recibido de Trii");
  });

  it("cada tabla va en una región con nombre que se enfoca para desplazarla con el teclado", () => {
    const raiz = pantalla();
    for (const id of ["t-proximos", "t-cruce"] as const) {
      const t = tabla(raiz, id)!;
      const region = t.parentElement!;
      expect([region.getAttribute("role"), region.getAttribute("aria-labelledby"), region.getAttribute("tabindex")], id).toEqual(["region", id, "0"]);
      expect([...t.querySelectorAll("thead th")].every((th) => th.getAttribute("scope") === "col"), id).toBe(true);
      expect(filas(t).every((tr) => tr.firstElementChild?.matches('th[scope="row"]')), id).toBe(true);
    }
  });

  it("las columnas de cifras alinean su encabezado con sus celdas (clase num); las de texto, no", () => {
    const raiz = pantalla();
    const numericas = (t: HTMLTableElement | null) => [...(t?.querySelectorAll("thead th") ?? [])].filter((th) => th.classList.contains("num")).map(texto);
    expect(numericas(tabla(raiz, "t-proximos"))).toEqual(["Valor por acción", "Tenencia", "Bruto estimado"]);
    expect(numericas(tabla(raiz, "t-cruce"))).toEqual(["Bruto esperado (estimado)", "Neto de Trii", "Diferencia bruto − neto"]);
    for (const id of ["t-proximos", "t-cruce"] as const) {
      const t = tabla(raiz, id)!;
      const columnas = [...t.querySelectorAll("thead th")].map((th) => th.classList.contains("num"));
      for (const tr of filas(t)) expect([...tr.children].map((c) => c.classList.contains("num")), id).toEqual(columnas);
    }
  });

  it("explica sus palabras a la familia en un glosario corto, sin recomendar nada (revisión a11y-architect, MEDIO)", () => {
    const glosario = seccion(pantalla()).querySelector("dl.do-glosario");
    expect([...(glosario?.querySelectorAll("dt") ?? [])].map(texto)).toEqual(["Fecha ex", "Tenencia", "Bruto", "Neto", "Cuota", "Revisar"]);
    for (const dd of glosario!.querySelectorAll("dd")) expect(texto(dd).length).toBeGreaterThan(20);
  });

  it("cada tabla trae la pista de que se desliza hacia los lados (la hoja la muestra solo en el celular)", () => {
    const s = seccion(pantalla());
    expect([...s.querySelectorAll(".do-desliza")].map(texto)).toEqual(["Deslice la tabla hacia los lados para ver todas las columnas.", "Deslice la tabla hacia los lados para ver todas las columnas."]);
    expect(seccion(pantalla(DECRETOS_VACIOS)).querySelectorAll(".do-desliza")).toHaveLength(0);
  });

  it("no trae formularios, botones ni campos", () => {
    expect(seccion(pantalla()).querySelectorAll("form, button, input, select, textarea")).toHaveLength(0);
  });
});

describe("próximos ex-dividendos", () => {
  it("columnas y una fila por decreto, en el orden dado: valor, fechas, tenencia, bruto estimado y referencia con su versión", () => {
    const t = tabla(pantalla(), "t-proximos");
    expect(encabezados(t)).toEqual(["Especie", "Decreto", "Valor por acción", "Fecha ex", "Fecha de pago", "Tenencia", "Bruto estimado", "Referencia oficial"]);
    expect(filas(t).map(celdas)).toEqual([
      ["FICTA", "Ordinario · cuota 2", "$ 41,37", "17-mar-2021", "24-mar-2021", "1.237 acciones", "$ 51.174,69", "Referencia oficial de FICTA, ordinario cuota 2 (sitio externo) · versión 2"],
      ["FICTB", "Extraordinario · cuota 1", "$ 13,70", "23-mar-2021", "31-mar-2021", "97 acciones", "$ 1.328,90", "Radicado SFC FICTICIO-4613 · versión 1"],
      ["FICTI", "Ordinario · cuota 1", "$ 23,17", "7-abr-2021", "14-abr-2021", "−10 acciones", "No se estima: la tenencia sale negativa (faltan órdenes cargadas).", "Referencia oficial de FICTI, ordinario cuota 1 (sitio externo) · versión 1"],
    ]);
  });

  it("una acción va en singular", () => {
    const t = tabla(pantalla({ ...DECRETOS, proximos: [proximo({ tenencia: "1", brutoEstimado: "41.37" })] }), "t-proximos");
    expect(celdas(filas(t)[0]!)[5]).toBe("1 acción");
  });

  it("explica que el bruto es una estimación y de qué tenencia sale", () => {
    const nota = texto(seccion(pantalla()).querySelector("#t-proximos ~ .do-nota-bruto"));
    expect(nota).toContain("estimación");
    expect(nota).toContain("tenencia");
  });

  it("sin próximos: lo dice, sin tabla", () => {
    const raiz = pantalla(DECRETOS_VACIOS);
    expect(tabla(raiz, "t-proximos")).toBeNull();
    expect(texto(seccion(raiz).querySelector(".do-vacio-proximos"))).toBe("No hay decretos registrados con fecha ex desde hoy.");
  });
});

describe("el cruce con lo recibido de Trii", () => {
  it("columnas: bruto esperado (estimado), neto de Trii y «diferencia bruto − neto»", () => {
    expect(encabezados(tabla(pantalla(), "t-cruce"))).toEqual([
      "Especie", "Fecha de pago", "Decretos", "Bruto esperado (estimado)", "Neto de Trii", "Diferencia bruto − neto", "Estado", "Por qué",
    ]);
  });

  it("nunca llama «retención» a la diferencia, ni en el texto ni en los atributos", () => {
    expect(html()).not.toMatch(/retenci[oó]n/i);
  });

  it("una fila por grupo, lo más reciente primero (como llega), con el estado en texto", () => {
    const t = tabla(pantalla(), "t-cruce");
    expect(filas(t).map((tr) => [texto(tr.firstElementChild), texto(tr.children[1]), texto(tr.querySelector(".do-cruce-estado-texto"))])).toEqual([
      ["FICTB", "12-mar-2021", "Pendiente"], ["FICTA", "17-feb-2021", "Recibido"], ["FICTB", "9-dic-2020", "No recibido"],
      ["FICTC", "18-nov-2020", "Sin decreto"], ["FICTA", "14-oct-2020", "Revisar"], ["FICTI", "9-sep-2020", "Revisar"],
    ]);
  });

  it("RECIBIDO: el decreto con su cuenta, el bruto, el neto con la fecha del pago, la diferencia y por qué", () => {
    const tr = filas(tabla(pantalla({ ...DECRETOS, cruce: [RECIBIDO] }), "t-cruce"))[0]!;
    expect(celdas(tr)).toEqual([
      "FICTA", "17-feb-2021",
      "Ordinario · cuota 1 · ex 10-feb-2021 · $ 4,291731 por acción × 1.237 acciones = $ 5.308,871247 · Referencia oficial de FICTA, ordinario cuota 1 (sitio externo) · versión 1",
      "$ 5.308,871247", "$ 4.613,27 Pago de Trii: 19-feb-2021", "$ 695,601247", "Estado del cruce: Recibido", EXPLICACION_ESTADO.RECIBIDO,
    ]);
  });

  it("SIN_DECRETO: sin decreto ni bruto ni diferencia; el neto del pago, sí", () => {
    const tr = filas(tabla(pantalla({ ...DECRETOS, cruce: [SIN_DECRETO] }), "t-cruce"))[0]!;
    expect(celdas(tr)).toEqual([
      "FICTC", "18-nov-2020", "Ningún decreto registrado le corresponde.", "—", "$ 37,91 Pago de Trii: 18-nov-2020", "—", "Estado del cruce: Sin decreto", EXPLICACION_ESTADO.SIN_DECRETO,
    ]);
  });

  it("varios decretos en el grupo, cada uno con su referencia (enlace o radicado); varios pagos, en plural", () => {
    const dos = { ...EN_DISPUTA, pagos: [...EN_DISPUTA.pagos, { clave: "pag-6", fechaPago: "2020-10-19", montoNeto: "0.37" }] };
    const tr = filas(tabla(pantalla({ ...DECRETOS, cruce: [dos] }), "t-cruce"))[0]!;
    const items = [...tr.children[2]!.querySelectorAll("li")].map(texto);
    expect(items).toEqual([
      "Ordinario · cuota 1 · ex 7-oct-2020 · $ 2,613719 por acción × 1.237 acciones = $ 3.233,170403 · Referencia oficial de FICTA, ordinario cuota 1 (sitio externo) · versión 1",
      "Extraordinario · cuota 1 · ex 7-oct-2020 · $ 0,971313 por acción × 1.237 acciones = $ 1.201,514181 · Radicado SFC FICTICIO-4711 · versión 1",
    ]);
    expect(texto(tr.children[4])).toBe("$ 3.917,43 Pagos de Trii: 16-oct-2020, 19-oct-2020");
  });

  it("PAGO_EN_DISPUTA: marcado a la vista en el estado y en la fila, con sus motivos en orden", () => {
    const t = tabla(pantalla(), "t-cruce");
    const [disputa] = filas(t).filter((tr) => texto(tr.children[1]) === "14-oct-2020");
    expect(disputa!.hasAttribute("data-disputa")).toBe(true);
    expect(texto(disputa!.querySelector(".do-disputa"))).toBe("Pago en disputa");
    expect([...disputa!.children[7]!.querySelectorAll("li")].map(texto)).toEqual([TEXTO_MOTIVO.PAGO_EN_DISPUTA, TEXTO_MOTIVO.CARGA_NO_CUBRE_LA_EX]);
    // Las demás filas no llevan la marca.
    expect(filas(t).filter((tr) => tr.hasAttribute("data-disputa") || tr.querySelector(".do-disputa"))).toHaveLength(1);
  });

  it("REVISAR con la tenencia negativa: el bruto negativo se muestra (no se recorta) y dice por qué", () => {
    const tr = filas(tabla(pantalla({ ...DECRETOS, cruce: [TENENCIA_NEGATIVA] }), "t-cruce"))[0]!;
    expect(celdas(tr)[3]).toBe("−$ 137,10");
    expect(texto(tr.children[2])).toContain("× −10 acciones = −$ 137,10");
    expect([...tr.children[7]!.querySelectorAll("li")].map(texto)).toEqual([TEXTO_MOTIVO.TENENCIA_NEGATIVA]);
  });

  it("un REVISAR sin motivos (C5b no lo da) no inventa una explicación: «—»", () => {
    const tr = filas(tabla(pantalla({ ...DECRETOS, cruce: [fila({ estado: "REVISAR", motivos: [] })] }), "t-cruce"))[0]!;
    expect(texto(tr.children[7])).toBe("—");
  });

  it("cada motivo de REVISAR tiene su texto, en el orden de C5b", () => {
    const todos = fila({ estado: "REVISAR", motivos: [...MOTIVOS_REVISAR] });
    const tr = filas(tabla(pantalla({ ...DECRETOS, cruce: [todos] }), "t-cruce"))[0]!;
    expect([...tr.children[7]!.querySelectorAll("li")].map(texto)).toEqual(MOTIVOS_REVISAR.map((m) => TEXTO_MOTIVO[m]));
  });

  it("cada estado sale con su texto y su data-estado (para el borde), nunca solo con color", () => {
    const t = tabla(pantalla({ ...DECRETOS, cruce: ESTADOS_CRUCE.map((estado, k) => fila({ clave: `k-${k}`, estado, motivos: estado === "REVISAR" ? ["NETO_MAYOR_QUE_BRUTO"] : [] })) }), "t-cruce");
    expect(filas(t).map((tr) => [tr.querySelector(".do-cruce-estado")?.getAttribute("data-estado"), texto(tr.querySelector(".do-cruce-estado-texto"))])).toEqual(
      ESTADOS_CRUCE.map((e) => [e, TEXTO_ESTADO_CRUCE[e]]),
    );
  });

  it("las notas: desde cuándo se muestra, la ventana de pago (de ventana.ts) y qué es la diferencia", () => {
    const s = seccion(pantalla());
    const notas = [...s.querySelectorAll(".do-nota")].map(texto).join(" ");
    expect(notas).toContain("desde el 17-mar-2020");
    expect(notas).toContain(`${VENTANA_PAGO_ANTES_DIAS} días antes`);
    expect(notas).toContain(`${VENTANA_PAGO_DESPUES_DIAS} días después`);
    expect(notas).toContain("Diferencia bruto − neto");
  });

  it("los grupos que no esperaban pago se cuentan aparte (singular y plural); sin ninguno, no se dice nada", () => {
    expect(texto(seccion(pantalla()).querySelector(".do-sin-tenencia"))).toBe("2 decretos con fecha ex pasada no esperaban pago: no había acciones de la especie antes de la ex.");
    expect(texto(seccion(pantalla({ ...DECRETOS, sinTenencia: 1 })).querySelector(".do-sin-tenencia"))).toBe("1 decreto con fecha ex pasada no esperaba pago: no había acciones de la especie antes de la ex.");
    expect(seccion(pantalla({ ...DECRETOS, sinTenencia: 0 })).querySelector(".do-sin-tenencia")).toBeNull();
  });

  it("sin filas: lo dice con la fecha desde la que se mira, sin tabla", () => {
    const raiz = pantalla(DECRETOS_VACIOS);
    expect(tabla(raiz, "t-cruce")).toBeNull();
    expect(texto(seccion(raiz).querySelector(".do-vacio-cruce"))).toBe("No hay decretos con fecha ex pasada ni pagos de Trii con fecha de pago desde el 17-mar-2020.");
  });
});

describe("la referencia oficial", () => {
  it("es enlace solo si es https a la SFC o a la BVC; sin target y sin mandar la página de origen", () => {
    const enlaces = [...seccion(pantalla()).querySelectorAll("a")];
    expect(enlaces.length).toBeGreaterThan(0);
    for (const a of enlaces) {
      const href = a.getAttribute("href") ?? "";
      expect(enlaceSeguro(href, HOSTS_REFERENCIAS), href).toBe(href);
      expect((a.getAttribute("rel") ?? "").split(" ").sort(), href).toEqual(["noopener", "noreferrer"]);
      expect(a.getAttribute("referrerpolicy"), href).toBe("no-referrer");
      expect(a.hasAttribute("target"), href).toBe(false);
    }
  });

  it.each([
    ["http://www.bvc.com.co/ficticio/x", "http://www.bvc.com.co/ficticio/x"],
    ["https://www.bvc.com.co.ejemplo.invalid/x", "https://www.bvc.com.co.ejemplo.invalid/x"],
    ["javascript:alert(1)", "javascript:alert(1)"],
    ["https://www.datos.gov.co/ficticio", "https://www.datos.gov.co/ficticio"],
  ])("%s no es enlace: queda como texto", (referencia, visible) => {
    const s = seccion(pantalla({ ...DECRETOS, proximos: [proximo({ referencia })], cruce: [] }));
    expect(s.querySelector("a")).toBeNull();
    expect(celdas(filas(tabla(s as HTMLElement, "t-proximos"))[0]!)[7]).toBe(`${visible} · versión 2`);
  });

  it("el radicado de la SFC es texto, con su número", () => {
    const s = seccion(pantalla({ ...DECRETOS, proximos: [PROXIMOS[1]!], cruce: [] }));
    expect(s.querySelector("a")).toBeNull();
    expect(texto(s.querySelector(".do-radicado"))).toBe("Radicado SFC FICTICIO-4613");
  });

  it("dice al lector adónde lleva: la referencia de esa especie y ese decreto, en un sitio externo", () => {
    const a = seccion(pantalla({ ...DECRETOS, proximos: [PROXIMOS[0]!], cruce: [] })).querySelector("a")!;
    expect(texto(a)).toBe("Referencia oficial de FICTA, ordinario cuota 2 (sitio externo)");
    expect(texto(a.querySelector(".sr"))).toBe("de FICTA, ordinario cuota 2 (sitio externo)");
  });
});

describe("las cifras", () => {
  it("se pintan exactas desde el texto decimal: nada se redondea", () => {
    const s = seccion(pantalla({ ...DECRETOS, proximos: [], cruce: [CRUCE[1]!] }));
    expect(texto(s)).toContain("$ 5.308,871247");
    expect(texto(s)).toContain("$ 695,601247");
  });
});
