// Enlaces a las fuentes de /datos-oficiales (frente datos-oficiales-pantalla, C6a): cada fuente del catálogo tiene su
// página oficial en https y en un host de la lista; al pintar se vuelve a validar, y lo que no cumple (http, javascript:,
// otro host, usuario o puerto en la URL) queda como texto, sin enlace.
import { describe, expect, it } from "vitest";
import { CATALOGO } from "@/datos-oficiales/catalogo";
import { HOSTS_FUENTES, enlaceDeFuente, enlaceSeguro } from "@/app/datos-oficiales/fuentes";

describe("enlaces de las fuentes", () => {
  it("cada fuente del catálogo tiene su enlace https a un host de la lista", () => {
    for (const s of CATALOGO) {
      const href = enlaceDeFuente(s.fuente);
      expect(href, s.codigo).not.toBeNull();
      const u = new URL(href!);
      expect(u.protocol, s.codigo).toBe("https:");
      expect(HOSTS_FUENTES.has(u.hostname), s.codigo).toBe(true);
    }
  });

  it("los hosts son los de las tres entidades (SFC por datos.gov.co, BanRep y DANE)", () => {
    expect([...HOSTS_FUENTES].sort()).toEqual(["suameca.banrep.gov.co", "www.dane.gov.co", "www.datos.gov.co"]);
  });

  it("una fuente desconocida no tiene enlace", () => {
    expect(enlaceDeFuente("sfc:otra")).toBeNull();
    expect(enlaceDeFuente("")).toBeNull();
  });

  it.each([
    "http://www.dane.gov.co/index.php",
    "javascript:alert(1)",
    "https://www.dane.gov.co.ejemplo.invalid/",
    "https://ejemplo.invalid/www.dane.gov.co",
    "https://alguien@www.dane.gov.co/",
    "https://www.dane.gov.co:8443/",
    "//www.dane.gov.co/",
    "no es una url",
  ])("%s queda sin enlace", (href) => {
    expect(enlaceSeguro(href)).toBeNull();
  });

  it("una página oficial de la lista pasa tal cual", () => {
    expect(enlaceSeguro("https://www.dane.gov.co/index.php")).toBe("https://www.dane.gov.co/index.php");
  });
});
