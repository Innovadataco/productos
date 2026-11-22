/**
 * La lista cerrada de códigos del validador (la que guarda `resumen_ia.motivos`), los límites, la versión y el aviso
 * fijo por tipo (sin dígitos; el de ESCENARIOS es el AVISO de las proyecciones).
 */
import { describe, expect, it } from "vitest";
import { PATRON_VERSION_PROMPT } from "@/ia/generador";
import { TIPOS_RESUMEN } from "@/ia/contrato";
import { CODIGOS_ERROR_VALIDADOR, CODIGOS_VALIDADOR, ErrorValidador, LIMITES_SALIDA, VERSION_VALIDADOR } from "@/ia/validador/codigos";
import { AVISOS } from "@/ia/validador/resumen";
import { AVISO } from "@/proyecciones/tipos";

describe("códigos del validador", () => {
  it("son exactamente los catorce del plan, en su orden, y están congelados", () => {
    expect(CODIGOS_VALIDADOR).toEqual([
      "SALIDA_INVALIDA", "LONGITUD", "CIFRA_SUELTA", "CIFRA_EN_PALABRAS", "HECHO_DESCONOCIDO", "HECHO_NO_CITADO",
      "ETIQUETA_NO_COINCIDE", "DIRECCION_CONTRADICE", "RECOMENDACION", "PREDICCION", "TRATO", "IDIOMA", "FORMATO", "RENDER_CIFRA",
    ]);
    expect(Object.isFrozen(CODIGOS_VALIDADOR)).toBe(true);
    expect(Object.isFrozen(CODIGOS_ERROR_VALIDADOR)).toBe(true);
  });

  it("los límites son los del plan y están congelados", () => {
    expect(LIMITES_SALIDA).toEqual({ minFrases: 1, maxFrases: 6, maxLargoFrase: 280, maxLargoTotal: 1200, maxLargoPalabra: 32 });
    expect(Object.isFrozen(LIMITES_SALIDA)).toBe(true);
  });

  it("la versión tiene la forma de las versiones de 008", () => {
    expect(VERSION_VALIDADOR).toMatch(PATRON_VERSION_PROMPT);
  });

  it("ErrorValidador lleva su código y nada más", () => {
    const error = new ErrorValidador("PAQUETE_NO_CONSTRUIDO");
    expect(error.name).toBe("ErrorValidador");
    expect(error.codigo).toBe("PAQUETE_NO_CONSTRUIDO");
    expect(error.message).toBe("Validador de la salida: PAQUETE_NO_CONSTRUIDO.");
  });
});

describe("aviso fijo", () => {
  it("hay uno por tipo, sin dígitos; ESCENARIOS usa el AVISO de las proyecciones", () => {
    expect(Object.keys(AVISOS).sort()).toEqual([...TIPOS_RESUMEN].sort());
    for (const tipo of TIPOS_RESUMEN) {
      expect(AVISOS[tipo].length).toBeGreaterThan(17);
      expect(AVISOS[tipo]).not.toMatch(/\p{N}/u);
    }
    expect(AVISOS.ESCENARIOS).toBe(AVISO);
    expect(AVISOS.DIARIO).toMatch(/no es (una )?recomendación/u);
    expect(Object.isFrozen(AVISOS)).toBe(true);
  });
});
