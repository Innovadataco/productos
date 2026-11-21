// Los dos campos cifrados del #11: fila_fuente.crudo y certificacion_fondo.encargo. Datos ficticios.
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  clasificarCrudo, clasificarEncargo, cifrarCrudo, cifrarEncargo, contextoCrudo, descifrarCrudo, descifrarEncargo,
  type LlaveCertificacionFondo, type LlaveFilaFuente,
} from "@/cifrado/campos";
import { ErrorCifrado } from "@/cifrado/errores";
import { obtenerLlavero } from "@/cifrado/llavero";
import { cifrar, esSobre } from "@/cifrado/sobre";

const clave = obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: "v1", CIFRADO_CLAVE_V1: randomBytes(32).toString("base64") });
const FILA: LlaveFilaFuente = { tipoFuente: "TRII_ORDENES", claveNatural: "a".repeat(64), ocurrencia: 1 };
const CERT: LlaveCertificacionFondo = { certificacionId: "cert-ficticia", instrumentoId: "inst-ficticio" };
const CRUDO = { "Fecha y hora": "13 nov 2024, 9:30 a. m.", "Símbolo de la acción": "FICTA", "Tipo de orden": "Venta", "Total invertido": "1234.56" };

function codigoDe(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    return e instanceof ErrorCifrado ? e.codigo : `otro: ${String(e)}`;
  }
  return "sin error";
}

describe("fila_fuente.crudo", () => {
  it("ida y vuelta: el sobre devuelve la misma fila", () => {
    const sobre = cifrarCrudo(CRUDO, FILA, clave);
    expect(esSobre(sobre)).toBe(true);
    expect(descifrarCrudo(sobre, FILA, clave)).toEqual(CRUDO);
    expect(JSON.stringify(sobre)).not.toMatch(/FICTA|Venta|1234\.56/);
  });

  it.each([
    ["otro tipo de fuente", { ...FILA, tipoFuente: "TRII_CAJA" }],
    ["otra clave natural", { ...FILA, claveNatural: "b".repeat(64) }],
    ["otra ocurrencia", { ...FILA, ocurrencia: 2 }],
  ])("el sobre de una fila no abre en otra (%s)", (_caso, otra) => {
    expect(codigoDe(() => descifrarCrudo(cifrarCrudo(CRUDO, FILA, clave), otra, clave))).toBe("AUTENTICACION_FALLIDA");
  });

  it("descifrar es estricto: una fila en claro no pasa (SOBRE_INVALIDO)", () => {
    expect(codigoDe(() => descifrarCrudo(CRUDO, FILA, clave))).toBe("SOBRE_INVALIDO");
  });

  it("si el contenido descifrado no es una fila de textos: CONTENIDO_INVALIDO", () => {
    const sobre = cifrar(JSON.stringify({ a: 1 }), contextoCrudo(FILA), clave);
    expect(codigoDe(() => descifrarCrudo(sobre, FILA, clave))).toBe("CONTENIDO_INVALIDO");
  });

  it("si el contenido descifrado ni siquiera es JSON: CONTENIDO_INVALIDO", () => {
    const sobre = cifrar("no es json", contextoCrudo(FILA), clave);
    expect(codigoDe(() => descifrarCrudo(sobre, FILA, clave))).toBe("CONTENIDO_INVALIDO");
  });

  it("clasifica: fila de textos en claro, sobre, y anómalo (sobre dañado o fila que no es de textos)", () => {
    expect(clasificarCrudo(CRUDO)).toBe("claro");
    expect(clasificarCrudo(cifrarCrudo(CRUDO, FILA, clave))).toBe("sobre");
    expect(clasificarCrudo({ v: 1, ct: "roto" })).toBe("anomalo");
    expect(clasificarCrudo({ ficticio: true })).toBe("anomalo");
    expect(clasificarCrudo(["a"])).toBe("anomalo");
    expect(clasificarCrudo("texto")).toBe("anomalo");
  });
});

describe("certificacion_fondo.encargo", () => {
  const ENCARGO = "ENC-FICTICIO-000123";

  it("ida y vuelta; se guarda como el sobre serializado, sin el encargo en claro", () => {
    const guardado = cifrarEncargo(ENCARGO, CERT, clave);
    expect(esSobre(JSON.parse(guardado))).toBe(true);
    expect(guardado).not.toContain(ENCARGO);
    expect(descifrarEncargo(guardado, CERT, clave)).toBe(ENCARGO);
  });

  it.each([
    ["otra certificación", { ...CERT, certificacionId: "cert-otra" }],
    ["otro instrumento", { ...CERT, instrumentoId: "inst-otro" }],
  ])("el sobre de un encargo no abre en otra fila (%s)", (_caso, otra) => {
    expect(codigoDe(() => descifrarEncargo(cifrarEncargo(ENCARGO, CERT, clave), otra, clave))).toBe("AUTENTICACION_FALLIDA");
  });

  it("un sobre no cambia de campo: el de un encargo no abre como crudo, ni al revés", () => {
    const deEncargo = JSON.parse(cifrarEncargo(ENCARGO, CERT, clave)) as unknown;
    expect(codigoDe(() => descifrarCrudo(deEncargo, FILA, clave))).toBe("AUTENTICACION_FALLIDA");
    const deCrudo = JSON.stringify(cifrarCrudo(CRUDO, FILA, clave));
    expect(codigoDe(() => descifrarEncargo(deCrudo, CERT, clave))).toBe("AUTENTICACION_FALLIDA");
  });

  it.each([["en claro", ENCARGO], ["JSON roto", "{no es json"], ["JSON que no es sobre", '{"v":1}']])(
    "descifrar es estricto (%s): SOBRE_INVALIDO",
    (_caso, valor) => {
      expect(codigoDe(() => descifrarEncargo(valor, CERT, clave))).toBe("SOBRE_INVALIDO");
    },
  );

  it("clasifica: en claro, sobre serializado, y anómalo (empieza por «{» pero no es un sobre válido)", () => {
    expect(clasificarEncargo(ENCARGO)).toBe("claro");
    expect(clasificarEncargo(cifrarEncargo(ENCARGO, CERT, clave))).toBe("sobre");
    expect(clasificarEncargo('{"v":1}')).toBe("anomalo");
    expect(clasificarEncargo("{roto")).toBe("anomalo");
  });
});
