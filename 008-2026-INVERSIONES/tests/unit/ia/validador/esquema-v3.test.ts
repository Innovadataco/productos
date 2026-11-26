/**
 * `salida-v3` (solo SIMULACION): el esquema de v2 más `revisar:[{segmentos}]`. `esquemaSalidaDe(tipo)` da v3 solo a
 * SIMULACION; los tres tipos de hoy siguen en v2, y el hash y la forma de `salida-v2` no cambian.
 */
import { describe, expect, it } from "vitest";
import { TIPOS_DIARIOS, TIPOS_RESUMEN } from "@/ia/contrato";
import { jsonCanonico, sha256Hex } from "@/ia/hash";
import {
  ESQUEMA_SALIDA,
  ESQUEMA_SALIDA_V3,
  HASH_ESQUEMA_SALIDA,
  HASH_ESQUEMA_SALIDA_V3,
  VERSION_ESQUEMA_SALIDA,
  VERSION_ESQUEMA_SALIDA_V3,
  esquemaSalidaDe,
} from "@/ia/prompts/esquema";

/** La huella de `salida-v2` antes de este cambio: si cambia, cambió el esquema que usan los tres tipos de hoy. */
const HASH_V2_DE_HOY = "e2ecd2b368c5570910774f612842db558ae5229834d09b062a65288813a52498";
const FRASES = ESQUEMA_SALIDA.properties as { frases: unknown };

describe("salida-v2 no cambia", () => {
  it("su versión y su hash son los de antes", () => {
    expect(VERSION_ESQUEMA_SALIDA).toBe("salida-v2");
    expect(HASH_ESQUEMA_SALIDA).toBe(HASH_V2_DE_HOY);
    expect(Object.keys(ESQUEMA_SALIDA.properties as object)).toEqual(["frases"]);
    expect(ESQUEMA_SALIDA.required).toEqual(["frases"]);
  });
});

describe("el esquema salida-v3", () => {
  it("es el de v2 más revisar, con los mismos ítems que las frases; cierra sus campos y no lleva largos", () => {
    expect(VERSION_ESQUEMA_SALIDA_V3).toBe("salida-v3");
    expect(ESQUEMA_SALIDA_V3).toEqual({
      type: "object",
      properties: { frases: FRASES.frases, revisar: FRASES.frases },
      required: ["frases", "revisar"],
      additionalProperties: false,
    });
    expect(JSON.stringify(ESQUEMA_SALIDA_V3)).not.toMatch(/minLength|maxLength|minItems|maxItems/);
  });

  it("está congelado de punta a punta y su hash es el del JSON canónico, distinto del de v2", () => {
    const recorrer = (nodo: unknown): void => {
      if (typeof nodo !== "object" || nodo === null) return;
      expect(Object.isFrozen(nodo)).toBe(true);
      for (const hijo of Object.values(nodo)) recorrer(hijo);
    };
    recorrer(ESQUEMA_SALIDA_V3);
    expect(HASH_ESQUEMA_SALIDA_V3).toBe(sha256Hex(jsonCanonico(ESQUEMA_SALIDA_V3)));
    expect(HASH_ESQUEMA_SALIDA_V3).not.toBe(HASH_ESQUEMA_SALIDA);
  });

  it("no comparte objetos con v2 (cambiar uno no toca el otro)", () => {
    expect(ESQUEMA_SALIDA_V3).not.toBe(ESQUEMA_SALIDA);
    expect((ESQUEMA_SALIDA_V3.properties as { frases: unknown }).frases).not.toBe(FRASES.frases);
  });
});

describe("esquemaSalidaDe", () => {
  it.each(TIPOS_DIARIOS)("%s sigue en v2: los tres de hoy no usan v3", (tipo) => {
    expect(esquemaSalidaDe(tipo)).toBe(ESQUEMA_SALIDA);
  });

  it("SIMULACION usa v3 y es el único tipo del contrato que lo usa", () => {
    expect(esquemaSalidaDe("SIMULACION")).toBe(ESQUEMA_SALIDA_V3);
    expect(TIPOS_RESUMEN.filter((t) => esquemaSalidaDe(t) === ESQUEMA_SALIDA_V3)).toEqual(["SIMULACION"]);
  });

  it.each([["OTRO"], [""], ["simulacion"], [undefined], [null], [7]])("un tipo desconocido (%s) falla cerrado con TypeError", (tipo) => {
    expect(() => esquemaSalidaDe(tipo as never)).toThrow(TypeError);
  });
});
