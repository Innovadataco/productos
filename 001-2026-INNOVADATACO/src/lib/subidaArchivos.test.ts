import { describe, it, expect } from "vitest";
import {
  extensionDe,
  saneaNombre,
  nombreDeArchivo,
  validaArchivo,
  MAX_TAMANO_ARCHIVO,
} from "./subidaArchivos";

describe("saneaNombre (§5.3)", () => {
  it("corta el paso por directorios: un nombre con ../ no sale de uploads/", () => {
    expect(saneaNombre("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(saneaNombre("../../etc/passwd")).not.toContain("/");
  });

  it("sustituye espacios y acentos, que es lo que traen las normas reales", () => {
    expect(saneaNombre("Resolución 1455 de 2025.pdf")).toBe("Resoluci_n_1455_de_2025.pdf");
  });

  it("respeta puntos, guiones y guiones bajos", () => {
    expect(saneaNombre("Decreto_1079-2015.pdf")).toBe("Decreto_1079-2015.pdf");
  });
});

describe("extensionDe", () => {
  it("normaliza a minúsculas", () => {
    expect(extensionDe("NORMA.PDF")).toBe(".pdf");
  });

  it("toma la última extensión, no la primera", () => {
    expect(extensionDe("informe.pdf.exe")).toBe(".exe");
  });

  it("devuelve vacío si no hay extensión", () => {
    expect(extensionDe("sinextension")).toBe("");
  });
});

describe("nombreDeArchivo (§5.3)", () => {
  it("antepone la marca de tiempo al nombre saneado", () => {
    expect(nombreDeArchivo("Circular 387.pdf", 1784862736403)).toBe(
      "1784862736403_Circular_387.pdf",
    );
  });
});

describe("validaArchivo (§2.6)", () => {
  const PDF = [".pdf"];
  const mensaje = "Solo se admiten archivos PDF";

  it("acepta un PDF de tamaño razonable", () => {
    expect(validaArchivo({ name: "norma.pdf", size: 730_000 }, PDF, mensaje)).toBeNull();
  });

  it("rechaza con 400 lo que no es del tipo permitido", () => {
    expect(validaArchivo({ name: "malicioso.exe", size: 10 }, PDF, mensaje)).toEqual({
      error: mensaje,
      status: 400,
    });
  });

  it("rechaza con 413 lo que excede el máximo", () => {
    expect(
      validaArchivo({ name: "enorme.pdf", size: MAX_TAMANO_ARCHIVO + 1 }, PDF, mensaje)?.status,
    ).toBe(413);
  });

  it("acepta justo el límite", () => {
    expect(validaArchivo({ name: "justo.pdf", size: MAX_TAMANO_ARCHIVO }, PDF, mensaje)).toBeNull();
  });

  it("acepta varias extensiones cuando la ruta las permite (expediente)", () => {
    const permitidas = [".pdf", ".xlsx", ".xls"];
    expect(validaArchivo({ name: "presupuesto.xlsx", size: 1000 }, permitidas, mensaje)).toBeNull();
  });
});
