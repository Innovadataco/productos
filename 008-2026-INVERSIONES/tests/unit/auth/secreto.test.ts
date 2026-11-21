// El secreto de la sesión (D-014): falla cerrada. Sin secreto, o con menos de 32 bytes, no hay sesión
// en ningún entorno. Contrato con el frente «producción»: AUTH_SECRET o el archivo de AUTH_SECRET_FILE.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SECRETO_DE_EJEMPLO, leerSecreto } from "@/auth/secreto";

/** Secretos inventados para la prueba (no se usan en ningún entorno). */
const SECRETO_32 = "s".repeat(32);
const SECRETO_31 = "s".repeat(31);
const sinArchivo = (): string => {
  throw new Error("no se esperaba leer un archivo");
};

describe("leerSecreto", () => {
  it("toma AUTH_SECRET cuando tiene 32 bytes o más", () => {
    const clave = leerSecreto({ AUTH_SECRET: SECRETO_32 }, sinArchivo);
    expect(new TextDecoder().decode(clave)).toBe(SECRETO_32);
  });

  it("sin secreto falla, en cualquier NODE_ENV", () => {
    for (const NODE_ENV of ["production", "development", "test", undefined]) {
      expect(() => leerSecreto({ NODE_ENV }, sinArchivo), String(NODE_ENV)).toThrow(/AUTH_SECRET/);
    }
  });

  it("con menos de 32 bytes falla, y el mensaje no trae el valor", () => {
    expect(() => leerSecreto({ AUTH_SECRET: SECRETO_31 }, sinArchivo)).toThrow(/32 bytes/);
    try {
      leerSecreto({ AUTH_SECRET: SECRETO_31 }, sinArchivo);
    } catch (e) {
      expect(String((e as Error).message)).not.toContain(SECRETO_31);
    }
  });

  it("cuenta bytes, no caracteres: 16 «ñ» son 32 bytes", () => {
    expect(() => leerSecreto({ AUTH_SECRET: "ñ".repeat(16) }, sinArchivo)).not.toThrow();
    expect(() => leerSecreto({ AUTH_SECRET: "ñ".repeat(15) }, sinArchivo)).toThrow(/32 bytes/);
  });

  it("AUTH_SECRET_FILE lee el archivo y le quita solo el salto de línea final", () => {
    const leidas: string[] = [];
    const clave = leerSecreto({ AUTH_SECRET_FILE: "/run/secrets/auth_secret" }, (ruta) => {
      leidas.push(ruta);
      return `${SECRETO_32}\n`;
    });
    expect(leidas).toEqual(["/run/secrets/auth_secret"]);
    expect(new TextDecoder().decode(clave)).toBe(SECRETO_32);
  });

  it("si el archivo no se puede leer, falla sin caer a AUTH_SECRET", () => {
    const ilegible = (): string => {
      throw new Error("ENOENT");
    };
    expect(() => leerSecreto({ AUTH_SECRET_FILE: "/no/existe" }, ilegible)).toThrow(/AUTH_SECRET_FILE/);
  });

  it("si llegan AUTH_SECRET y AUTH_SECRET_FILE a la vez, falla por ambigüedad", () => {
    expect(() => leerSecreto({ AUTH_SECRET: SECRETO_32, AUTH_SECRET_FILE: "/run/secrets/auth_secret" }, () => SECRETO_32)).toThrow(
      /a la vez/,
    );
  });

  it("un archivo con un secreto corto también falla", () => {
    expect(() => leerSecreto({ AUTH_SECRET_FILE: "/run/secrets/auth_secret" }, () => `${SECRETO_31}\n`)).toThrow(/32 bytes/);
  });

  it("en producción rechaza el secreto de ejemplo de .env.example (copiar el ejemplo no basta)", () => {
    const ejemplo = readFileSync(fileURLToPath(new URL("../../../.env.example", import.meta.url)), "utf8");
    expect(ejemplo).toContain(`AUTH_SECRET="${SECRETO_DE_EJEMPLO}"`);
    expect(() => leerSecreto({ NODE_ENV: "production", AUTH_SECRET: SECRETO_DE_EJEMPLO }, sinArchivo)).toThrow(/ejemplo/);
    expect(() => leerSecreto({ NODE_ENV: "development", AUTH_SECRET: SECRETO_DE_EJEMPLO }, sinArchivo)).not.toThrow();
  });
});
