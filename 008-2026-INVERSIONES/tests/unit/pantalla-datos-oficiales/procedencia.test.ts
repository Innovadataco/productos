// @vitest-environment jsdom
// /datos-oficiales ya dice de dónde y de cuándo es cada cifra (frente fecha-hora-datos): esta prueba lo fija para que no
// se pierda. Cada tarjeta con datos dice el periodo de su dato (la vigencia o el mes), cuándo lo trajo 008 en hora de
// Colombia (del `traidoEn` de valor_serie_oficial) y su fuente: la SFC, el Banco de la República o el DANE, con el
// código con que la guarda la base. Una serie sin datos no inventa ni fecha ni hora. Vistas inventadas (2021).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DatosOficiales } from "@/app/datos-oficiales/DatosOficiales";
import type { SerieConDatos, SerieVista } from "@/app/datos-oficiales/tipos";
import { IBR, IPC, TPM, TRM, datos, sinDatos } from "./ficticio";

const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

function tarjetas(series: readonly SerieVista[] = [TRM, TPM, IBR, IPC]): HTMLElement[] {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(createElement(DatosOficiales, { datos: datos(series) }));
  return [...raiz.querySelectorAll<HTMLElement>("article.do-serie")];
}
const par = (t: HTMLElement, termino: string) => texto([...t.querySelectorAll("dt")].find((dt) => texto(dt) === termino)?.nextElementSibling);

const ESPERADO: readonly (readonly [SerieConDatos, string, string, RegExp])[] = [
  [TRM, "vigente el 17-mar-2021", "16-mar-2021 a las 18:41 (hora de Colombia)", /^Superintendencia Financiera .* sfc:32sa-8pi3$/],
  [TPM, "vigente el 16-mar-2021", "17-mar-2021 a las 07:13 (hora de Colombia)", /^Banco de la República .* banrep:DF_CBR_DAILY_HIST\.IRCBRM01\.PA$/],
  [IBR, "vigente el 5-mar-2021", "6-mar-2021 a las 09:02 (hora de Colombia)", /^Banco de la República .* banrep:DF_IBR_DAILY_HIST\.IRIBRM03\.ER$/],
  [IPC, "corresponde a feb-2021", "9-mar-2021 a las 20:57 (hora de Colombia)", /^DANE .* dane:anex-IPC-Indices$/],
];

describe("cada tarjeta de /datos-oficiales con su procedencia", () => {
  it("el periodo del dato, cuándo lo trajo 008 en hora de Colombia y la fuente con su código", () => {
    const ts = tarjetas();
    expect(ts).toHaveLength(ESPERADO.length);
    ESPERADO.forEach(([serie, periodo, traido, fuente], k) => {
      const t = ts[k]!;
      expect(texto(t.querySelector("h2")), serie.codigo).toBe(serie.nombre);
      expect(texto(t.querySelector(".do-vigencia")), serie.codigo).toContain(periodo);
      expect(par(t, "Traído el"), serie.codigo).toBe(traido);
      expect(par(t, "Fuente"), serie.codigo).toMatch(fuente);
    });
  });

  it("una serie sin datos no inventa ni el periodo ni la hora", () => {
    const [t] = tarjetas([sinDatos("TRM")]);
    expect(t!.querySelector(".do-vigencia")).toBeNull();
    expect([...t!.querySelectorAll("dt")].map(texto)).not.toContain("Traído el");
  });
});
