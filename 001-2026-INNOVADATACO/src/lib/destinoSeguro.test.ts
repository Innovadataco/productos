import { describe, it, expect } from "vitest";
import { destinoSeguro } from "./destinoSeguro";

describe("destinoSeguro (spec 005, FR-018)", () => {
  it("conserva rutas internas, con y sin query", () => {
    expect(destinoSeguro("/licitaciones")).toBe("/licitaciones");
    expect(destinoSeguro("/documents?includeInactive=true")).toBe("/documents?includeInactive=true");
    expect(destinoSeguro("/")).toBe("/");
  });

  it("descarta destinos externos aunque empiecen por barra", () => {
    expect(destinoSeguro("//evil.com")).toBe("/");
    expect(destinoSeguro("/\\evil.com")).toBe("/");
  });

  it("descarta URLs absolutas", () => {
    expect(destinoSeguro("https://evil.com")).toBe("/");
    expect(destinoSeguro("http://localhost:5001/configuracion")).toBe("/");
  });

  it("cae a la página principal cuando no hay destino", () => {
    expect(destinoSeguro(null)).toBe("/");
    expect(destinoSeguro(undefined)).toBe("/");
    expect(destinoSeguro("")).toBe("/");
  });

  it("descarta cualquier cosa que no sea una ruta", () => {
    expect(destinoSeguro("javascript:alert(1)")).toBe("/");
    expect(destinoSeguro("configuracion")).toBe("/");
  });
});
