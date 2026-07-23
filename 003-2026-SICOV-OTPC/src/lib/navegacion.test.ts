import { describe, it, expect } from "vitest";
import { derivarMigas, rutaPadre } from "./navegacion";

describe("navegación del dashboard (fix I-14)", () => {
  it("en la raíz del dashboard hay una sola miga y no hay retorno", () => {
    expect(derivarMigas("/dashboard")).toEqual([{ href: "/dashboard", etiqueta: "Inicio" }]);
    expect(rutaPadre("/dashboard")).toBeNull();
  });

  it("un submódulo enlaza a Inicio y retorna al padre", () => {
    expect(derivarMigas("/dashboard/salidas")).toEqual([
      { href: "/dashboard", etiqueta: "Inicio" },
      { href: "/dashboard/salidas", etiqueta: "Salidas" },
    ]);
    expect(rutaPadre("/dashboard/salidas")).toBe("/dashboard");
  });

  it("dos niveles: Salidas → Nueva retorna a Salidas", () => {
    expect(derivarMigas("/dashboard/salidas/nueva")).toEqual([
      { href: "/dashboard", etiqueta: "Inicio" },
      { href: "/dashboard/salidas", etiqueta: "Salidas" },
      { href: "/dashboard/salidas/nueva", etiqueta: "Nueva" },
    ]);
    expect(rutaPadre("/dashboard/salidas/nueva")).toBe("/dashboard/salidas");
  });

  it("segmentos futuros (specs 005-008) obtienen etiqueta sin tocar el código", () => {
    const migas = derivarMigas("/dashboard/mantenimientos/carga-masiva");
    expect(migas.map((m) => m.etiqueta)).toEqual(["Inicio", "Mantenimientos", "Carga masiva"]);
    expect(rutaPadre("/dashboard/mantenimientos/carga-masiva")).toBe("/dashboard/mantenimientos");
  });

  it("fuera del dashboard no emite migas (el breadcrumb no se renderiza)", () => {
    expect(derivarMigas("/login")).toEqual([]);
    expect(rutaPadre("/login")).toBeNull();
    expect(derivarMigas("")).toEqual([]);
  });

  it("tolera barras finales", () => {
    expect(derivarMigas("/dashboard/salidas/")).toHaveLength(2);
  });
});
