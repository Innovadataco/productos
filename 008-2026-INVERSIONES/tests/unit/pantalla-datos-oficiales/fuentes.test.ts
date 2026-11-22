// Enlaces a las fuentes de /datos-oficiales (frente datos-oficiales-pantalla, C6a): cada fuente del catálogo tiene su
// página oficial en https y en un host de la lista; al pintar se vuelve a validar, y lo que no cumple (http, javascript:,
// otro host, usuario o puerto en la URL) queda como texto, sin enlace.
// La referencia oficial de un decreto (frente datos-oficiales-decretos-pantalla, C6b) es enlace solo si es https a la SFC
// o a la BVC (la condición de C1: dividendo_decretado_referencia_chk, los patrones de REFERENCIAS_OFICIALES); el radicado
// de la SFC (sfc:<radicado>) es texto con su número, y lo demás, texto tal cual.
import { describe, expect, it } from "vitest";
import { CATALOGO } from "@/datos-oficiales/catalogo";
import { REFERENCIAS_OFICIALES } from "@/datos-oficiales/decretos/filas";
import { HOSTS_FUENTES, HOSTS_REFERENCIAS, enlaceDeFuente, enlaceSeguro, referenciaOficial } from "@/app/datos-oficiales/fuentes";

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

describe("la referencia oficial de un decreto", () => {
  it("los hosts son los de los patrones https de C1 (REFERENCIAS_OFICIALES), ni uno más", () => {
    const deC1 = REFERENCIAS_OFICIALES.filter((r) => r.startsWith("^https://")).map((r) => /^\^https:\/\/(.+?)\//.exec(r)![1]!.replace(/\\\./g, "."));
    expect(deC1.sort()).toEqual(["www.bvc.com.co", "www.superfinanciera.gov.co"]);
    expect([...HOSTS_REFERENCIAS].sort()).toEqual(deC1);
  });

  it.each(["https://www.bvc.com.co/ficticio/c6b-1", "https://www.superfinanciera.gov.co/ficticio/c6b?r=4613#parte"])("%s es enlace, tal cual", (ref) => {
    expect(enlaceSeguro(ref, HOSTS_REFERENCIAS)).toBe(ref);
    expect(referenciaOficial(ref)).toEqual({ tipo: "ENLACE", href: ref });
  });

  it.each([
    "http://www.bvc.com.co/ficticio/x",
    "javascript:alert(1)",
    "https://www.bvc.com.co.ejemplo.invalid/x",
    "https://ejemplo.invalid/www.bvc.com.co",
    "https://alguien@www.superfinanciera.gov.co/x",
    "https://www.bvc.com.co:8443/x",
    "https://www.datos.gov.co/x",
    "//www.bvc.com.co/x",
    "sfc:FICTICIO-4613",
    "",
  ])("%s no es enlace", (ref) => {
    expect(enlaceSeguro(ref, HOSTS_REFERENCIAS)).toBeNull();
    expect(referenciaOficial(ref).tipo).not.toBe("ENLACE");
  });

  it("los hosts de las fuentes de las series no sirven para una referencia, ni al revés", () => {
    expect(enlaceSeguro("https://www.dane.gov.co/index.php", HOSTS_REFERENCIAS)).toBeNull();
    expect(enlaceSeguro("https://www.bvc.com.co/ficticio/x")).toBeNull();
  });

  it("el radicado de la SFC: texto con su número (el patrón de C1)", () => {
    expect(referenciaOficial("sfc:FICTICIO-4613")).toEqual({ tipo: "RADICADO", radicado: "FICTICIO-4613" });
    expect(referenciaOficial("sfc:").tipo).toBe("TEXTO");
    expect(referenciaOficial(`sfc:${"a".repeat(61)}`).tipo).toBe("TEXTO");
    expect(referenciaOficial("sfc:con espacio").tipo).toBe("TEXTO");
  });

  it("lo demás, texto tal cual", () => {
    expect(referenciaOficial("http://www.bvc.com.co/x")).toEqual({ tipo: "TEXTO", texto: "http://www.bvc.com.co/x" });
  });
});
