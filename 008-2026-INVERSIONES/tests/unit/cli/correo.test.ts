// El correo que reciben los CLI que crean o tocan el dueño (importar-trii y crear-acceso-inicial, O1): una opción
// o un valor que empieza por «-» nunca es el correo. Datos inventados.
import { describe, expect, it } from "vitest";
import { correoDeCli } from "@/cli/correo";
import { EMAIL_MAX } from "@/auth/limites";

describe("correoDeCli", () => {
  it("acepta un correo y lo devuelve sin espacios a los lados", () => {
    expect(correoDeCli("dueno@ejemplo.invalid")).toBe("dueno@ejemplo.invalid");
    expect(correoDeCli("  dueno@ejemplo.invalid \t")).toBe("dueno@ejemplo.invalid");
    expect(correoDeCli("dueno.o1+fict@sub.ejemplo.invalid")).toBe("dueno.o1+fict@sub.ejemplo.invalid");
  });

  it("rechaza lo que falta, lo vacío y lo que no tiene forma de correo", () => {
    for (const malo of [undefined, "", "   ", "no-es-correo", "a@b", "@ejemplo.invalid", "a@@ejemplo.invalid", "a b@ejemplo.invalid", "a@ejemplo .invalid"]) {
      expect(correoDeCli(malo), String(malo)).toBeNull();
    }
  });

  it("rechaza un valor que empieza por «-»: una opción nunca es el correo", () => {
    for (const malo of ["--crear-dueno", "--reiniciar-totp", "--d@ejemplo.invalid", "-d@ejemplo.invalid", " -d@ejemplo.invalid"]) {
      expect(correoDeCli(malo), malo).toBeNull();
    }
  });

  it("rechaza caracteres de control (ESC, saltos de línea, DEL, C1)", () => {
    for (const malo of ["d\u001b[31m@ejemplo.invalid", "d@ejemplo.invalid\nx", "d\u007f@ejemplo.invalid", "d\u0085@ejemplo.invalid", "d\u0000@ejemplo.invalid"]) {
      expect(correoDeCli(malo), JSON.stringify(malo)).toBeNull();
    }
  });

  // Revisión (BAJO): invisibles y controles de dirección de texto desfiguran lo que se ve en la consola.
  it("rechaza invisibles y controles de dirección de texto (U+200B-200F, U+2028-202E, U+2060-2069, U+FEFF, U+00AD)", () => {
    for (const cp of [0x200b, 0x200d, 0x200e, 0x200f, 0x2028, 0x2029, 0x202a, 0x202e, 0x2060, 0x2066, 0x2069, 0xfeff, 0x00ad]) {
      const malo = `d${String.fromCodePoint(cp)}@ejemplo.invalid`;
      expect(correoDeCli(malo), cp.toString(16)).toBeNull();
    }
  });

  it("respeta EMAIL_MAX: justo en el tope pasa, uno más no", () => {
    const dominio = "@ejemplo.invalid";
    const justo = `${"a".repeat(EMAIL_MAX - dominio.length)}${dominio}`;
    expect(correoDeCli(justo)).toBe(justo);
    expect(correoDeCli(`a${justo}`)).toBeNull();
  });
});
