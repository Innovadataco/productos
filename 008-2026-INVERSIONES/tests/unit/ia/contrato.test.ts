/**
 * Constantes cerradas del contrato de hechos: las listas exactas, congeladas, y los campos de la vista ciega.
 */
import { describe, expect, it } from "vitest";
import {
  CALIDADES, CAMPOS_HECHO_CIEGO, CAMPOS_PAQUETE_CIEGO, CERCANIAS, DIRECCIONES, FRESCURAS, MAX_HECHOS, PATRON_ID_HECHO, TIPOS_RESUMEN,
  UNIDADES, VERSION_HECHOS,
} from "@/ia/contrato";

describe("constantes del contrato", () => {
  it("la versión del contrato es hechos-v1", () => {
    expect(VERSION_HECHOS).toBe("hechos-v1");
  });

  it.each([
    ["TIPOS_RESUMEN", TIPOS_RESUMEN, ["DIARIO", "REGLAS", "ESCENARIOS"]],
    ["CALIDADES", CALIDADES, ["VERIFICADO", "NO_VERIFICADO", "ESTIMADO", "CALCULADO", "ATRASADO"]],
    ["DIRECCIONES", DIRECCIONES, ["SUBE", "BAJA", "IGUAL", "NO_APLICA"]],
    ["CERCANIAS", CERCANIAS, ["CERCA", "LEJOS", "NO_APLICA"]],
    ["FRESCURAS", FRESCURAS, ["HOY", "RECIENTE", "ATRASADO"]],
    ["UNIDADES", UNIDADES, ["PESOS", "PESOS_POR_DOLAR", "PORCENTAJE", "DIAS", "MESES", "ESPECIES", "FECHA", "NOMBRE"]],
  ])("%s es la lista cerrada exacta y está congelada", (_nombre, lista, esperada) => {
    expect([...lista]).toEqual(esperada);
    expect(Object.isFrozen(lista)).toBe(true);
  });

  it("los ids son «H» y dos dígitos, hasta noventa y nueve hechos", () => {
    expect(MAX_HECHOS).toBe(99);
    expect(PATRON_ID_HECHO.test("H01")).toBe(true);
    expect(PATRON_ID_HECHO.test("H99")).toBe(true);
    for (const malo of ["H1", "H001", "h01", "X01", " H01", "H01 ", "H0a"]) expect(PATRON_ID_HECHO.test(malo)).toBe(false);
  });

  it("la vista ciega lleva solo estos campos: ni valor, ni presentación, ni unidad, ni fuente, ni fecha", () => {
    expect([...CAMPOS_HECHO_CIEGO]).toEqual(["id", "clave", "etiqueta", "sujeto", "especie", "direccion", "cercania", "frescura", "calidad", "obligatorio"]);
    expect([...CAMPOS_PAQUETE_CIEGO]).toEqual(["tipo", "hechos"]);
    for (const prohibido of ["valor", "presentacion", "unidad", "fuente", "fecha"]) expect(CAMPOS_HECHO_CIEGO).not.toContain(prohibido);
    for (const prohibido of ["version", "hoy", "avisos", "versionesCalculo", "hash"]) expect(CAMPOS_PAQUETE_CIEGO).not.toContain(prohibido);
    expect(Object.isFrozen(CAMPOS_HECHO_CIEGO) && Object.isFrozen(CAMPOS_PAQUETE_CIEGO)).toBe(true);
  });
});
