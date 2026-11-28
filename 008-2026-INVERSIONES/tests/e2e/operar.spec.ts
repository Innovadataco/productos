/**
 * E2E de /operar (frente operar-informe) contra la base e2e de tests/e2e/sembrar.ts (sin siembra propia: la zona de este
 * frente no la incluye). Lo que ya siembran sembrar-plan.ts y sembrar-datos-oficiales.ts:
 *  - FICTB, cierre de 1.913 bajo su nivel de 2.000: la única tocada, en «Se cumplen o están en el nivel»; su plazo venció
 *    (31-dic-2024), así que dice que la condición se da y que el plazo venció, nunca «se cumple»;
 *  - FICTC, con su último cierre del 1-nov-2024: la del cierre atrasado («sin cierre al día», nunca «se cumple»);
 *  - FICTA a +9,09 % de su nivel, la de monto por orden y la escrita: el resto;
 *  - ninguna regla queda a menos del 3 % de su nivel: el grupo de las cercanas dice que está vacío (la cercana se
 *    prueba en unidad y en integración; llevarla al e2e pide cambiar la siembra, fuera de la zona);
 *  - los tres ex-dividendos de DECRETOS_E2E que caen en los próximos 30 días.
 * La referencia del tablero es el 22-nov-2024 y la app corre con la fecha real: la carga de precios figura detenida (el
 * aviso lo dice dentro del recuadro fijo), así que ninguna regla dice «Hoy se cumple». A 375 px, en claro y en oscuro:
 * sin desborde, la tabla se desplaza con el teclado en su caja, el encabezado fijo no tapa el foco, el texto con
 * contraste AA y ninguna expresión de consejo. Correos y contraseñas inventados.
 */
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { AVISO_DECISION } from "../../src/app/operar/textos";
import { fecha } from "../../src/app/tablero/formato";
import { sumarDias } from "../../src/plan/fechas";
import { prohibidasEn } from "../unit/operar/informe/lenguaje";
import { hoyDelE2E } from "./base";
import { PaginaTablero } from "./pagina-tablero";
import { DECRETOS_E2E } from "./sembrar-datos-oficiales";
import { test } from "./sesion";

const ANCHO_CELULAR = { width: 375, height: 812 };
const AVISO = AVISO_DECISION;
const enDias = (dias: number) => fecha(sumarDias(hoyDelE2E(), dias).toISOString().slice(0, 10));

/** El texto de cada elemento de la lista de un grupo (sus párrafos, unidos por un espacio). */
const elementos = (grupo: Locator) =>
  grupo.locator("li").evaluateAll((lis) => lis.map((li) => {
    const partes = [...li.querySelectorAll("p")].map((p) => (p.textContent ?? "").replace(/\s+/g, " ").trim());
    return partes.length > 0 ? partes.join(" ") : (li.textContent ?? "").replace(/\s+/g, " ").trim();
  }));

/** Contraste del texto contra el primer fondo opaco de sus ancestros (WCAG). */
const contraste = (l: Locator) =>
  l.evaluate((el) => {
    const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    let fondo: Element | null = el;
    while (fondo && (rgba(getComputedStyle(fondo).backgroundColor)[3] ?? 1) === 0) fondo = fondo.parentElement;
    const bg = fondo ? getComputedStyle(fondo).backgroundColor : getComputedStyle(document.body).backgroundColor;
    const [l1, l2] = [lum(rgba(getComputedStyle(el).color)), lum(rgba(bg))].sort((x, y) => y - x);
    return (l1! + 0.05) / (l2! + 0.05);
  });

async function abrirOperar(page: Page, info: TestInfo): Promise<void> {
  await PaginaTablero.abrir(page, info);
  await page.goto("/operar");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Informe para operar");
}

/** El bloque de un grupo de reglas (no es una región: lo nombra su h3). */
const grupoDe = (page: Page, titulo: string) => page.locator(".op-grupo").filter({ has: page.getByRole("heading", { level: 3, name: titulo, exact: true }) });

test.describe("pantalla /operar", () => {
  test("sin sesión lleva a ingresar", async ({ page }) => {
    await page.goto("/operar");
    await expect(page).toHaveURL("/ingresar");
  });

  for (const tema of ["light", "dark"] as const) {
    const nombre = tema === "light" ? "claro" : "oscuro";

    test.describe(`a 375 px · ${nombre}`, () => {
      test.use({ viewport: ANCHO_CELULAR, colorScheme: tema });

      test("la regla tocada, la del cierre atrasado, el resto, las fechas y el aviso; sin desborde ni consejos", async ({ page }, info) => {
        await abrirOperar(page, info);
        const main = page.getByRole("main");

        // El aviso fijo, los precios y, dentro del mismo recuadro, que la carga se detuvo (sin región viva).
        await expect(page.getByRole("note", { name: "Aviso" })).toHaveText(
          `${AVISO} Precios: último cierre disponible (22-nov-2024). Atención: los precios no se han actualizado desde el 22-nov-2024.`,
        );
        // Dentro de main (fuera queda el anunciador de rutas de Next, que es suyo).
        await expect(main.locator('[role="status"], [aria-live]')).toHaveCount(0);
        await expect(page.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Operar", exact: true })).toHaveAttribute("aria-current", "page");
        await expect(page).toHaveTitle("Informe para operar");

        // Sus reglas hoy.
        const seCumplen = grupoDe(page, "Se cumplen o están en el nivel");
        expect(await elementos(seCumplen)).toEqual([
          "Su regla de FICTB dice: vender si el cierre queda por debajo de $ 2.000. La condición se da con el cierre del 22-nov-2024 ($ 1.913, por debajo del nivel), pero su plazo venció. Plazo: venció el 31-dic-2024.",
        ]);
        await expect(grupoDe(page, "Cerca de su nivel (a menos del 3 %)")).toContainText("Ninguna regla está a menos del 3 % de su nivel.");
        const resto = await elementos(grupoDe(page, "El resto de sus reglas"));
        expect(resto.slice(0, 2)).toEqual([
          "Su regla de FICTA dice: vender 50 acciones si el cierre queda por encima de $ 1.200. El cierre del 22-nov-2024 fue de $ 1.100: le falta subir 9,09 % para tocar su nivel. Plazo: sin plazo.",
          "Su regla de FICTC dice: comprar 10 acciones si el cierre queda por debajo de $ 480. Sin cierre al día: el último cierre es del 1-nov-2024 ($ 505). Plazo: sin plazo.",
        ]);
        // Las dos de portafolio van al final, en el orden de su id (que la siembra no fija).
        expect([...resto.slice(2)].sort()).toEqual([
          "Su regla de portafolio dice: no actuar si el monto por orden es menor a $ 1.234.000. Inversiones no la mide con los cierres: aplica al monto de cada orden. Plazo: sin plazo.",
          "Su regla de portafolio dice: «Siempre orden límite (ficticia)». Es una postura del plan: no depende de un nivel de precio. Plazo: sin plazo.",
        ].sort());
        await expect(main).not.toContainText("Hoy se cumple");

        // El estado: FICTC marcada con el cierre atrasado; la tabla se desplaza con el teclado dentro de su caja.
        const tabla = page.getByRole("table", { name: /^Estado por especie/ });
        const fila = tabla.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "FICTC", exact: true }) });
        await expect(fila).toContainText("$ 505 · 1-nov-2024 cierre atrasado");
        const caja = page.getByRole("region", { name: "Estado por especie", exact: true });
        await caja.focus();
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => caja.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);

        // Las fechas: los ex-dividendos de la siembra que caen en la ventana, en orden.
        const proximos = DECRETOS_E2E.filter((d) => d.ex >= 0 && d.ex <= 30).sort((a, b) => a.ex - b.ex);
        const fechas = await elementos(page.getByRole("region", { name: "Fechas de los próximos 30 días", exact: true }));
        expect(fechas.map((t) => t.split(" · ")[0])).toEqual(proximos.map((d) => enDias(d.ex)));
        expect(fechas.map((t) => /Ex-dividendo de (\w+)/.exec(t)?.[1])).toEqual(proximos.map((d) => d.especie));
        expect(fechas[0]).toContain(`pago el ${enDias(proximos[0]!.pago)}`);

        // Los escenarios, solo como enlace.
        await expect(page.getByRole("region", { name: "Escenarios", exact: true }).getByRole("link", { name: "Proyecciones", exact: true })).toHaveAttribute("href", "/proyecciones");

        // Sin desborde a lo ancho; el encabezado fijo cabe en el margen de desplazamiento (el foco no queda debajo).
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
        const [alto, margen] = await page.evaluate(() => [document.querySelector("header.top")!.getBoundingClientRect().height, parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)]);
        expect(alto).toBeLessThanOrEqual(margen!);

        // Contraste AA del texto que importa, ningún consejo en el texto y nada que escriba.
        const textos = [
          seCumplen.locator(".op-frase").first(), seCumplen.locator(".op-estado.aviso").first(), seCumplen.locator(".op-plazo.aviso").first(),
          page.getByRole("note", { name: "Aviso" }).locator("p").first(), page.locator(".op-precios"), page.locator(".op-aviso .aviso"),
          fila.locator(".chip.aviso"), main.locator(".nota").first(), main.getByRole("link", { name: "Ver el plan completo" }), tabla.locator("thead th").first(),
        ];
        for (const l of textos) expect(await contraste(l), await l.evaluate((e) => `${e.tagName}.${e.className}`)).toBeGreaterThanOrEqual(4.5);
        expect(prohibidasEn(await main.innerText())).toEqual([]);
        // El único formulario es el del simulador «¿Y si…?» (O2/O5, no guarda nada); el informe no tiene controles.
        await expect(main.locator(":is(form, input, button, textarea, select):not(section.op-simulador *)")).toHaveCount(0);
        await expect(main.locator("section.op-simulador form")).toHaveCount(1);
        await page.screenshot({ path: info.outputPath(`operar-375-${nombre}.png`), fullPage: true });
      });
    });
  }
});
