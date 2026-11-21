// Argumentos de scripts/construir-lotes.ts (D1), sin abrir procesos: el parser es puro.
import { describe, expect, it } from "vitest";
import { ErrorArgumentosConstruir, leerArgumentosConstruir, USO_CONSTRUIR } from "@/lotes/argumentos";

const leer = (argv: readonly string[], entorno: Record<string, string | undefined> = {}) => leerArgumentosConstruir(argv, entorno);

describe("leerArgumentosConstruir", () => {
  it("sin argumentos construye y escribe (lo documentado: npm run lotes:construir)", () => {
    expect(leer([])).toEqual({ ensayo: false, ayuda: false });
  });

  it("--ensayo y --ayuda", () => {
    expect(leer(["--ensayo"])).toEqual({ ensayo: true, ayuda: false });
    expect(leer(["--ayuda"])).toEqual({ ensayo: false, ayuda: true });
  });

  it.each([
    [["--xyz"], /desconocida/],
    [["construir"], /desconocida/],
    [["--"], /desconocida/],
    [["--ensayo=si"], /desconocida/],
    [["-h"], /desconocida/],
    [["--ensayo", "--ensayo"], /repetida/],
    [["--ayuda", "--ensayo"], /va sola/],
    [["--ensayo", "--ayuda"], /va sola/],
  ])("rechaza %j", (argv, motivo) => {
    expect(() => leer(argv)).toThrow(ErrorArgumentosConstruir);
    expect(() => leer(argv)).toThrow(motivo);
  });

  it("si npm se quedó con --ensayo o --ayuda (sin «--»), rechaza y dice cómo pasarla", () => {
    expect(() => leer([], { npm_config_ensayo: "true" })).toThrow(/npm run lotes:construir -- --ensayo/);
    expect(() => leer([], { npm_config_ayuda: "" })).toThrow(/npm run lotes:construir -- --ayuda/);
    expect(leer(["--ensayo"], { npm_config_otra: "true" })).toEqual({ ensayo: true, ayuda: false });
  });

  it("si npm se quedó con --dry-run (lo que muchos escriben para ensayar), rechaza y ofrece --ensayo", () => {
    expect(() => leer([], { npm_config_dry_run: "true" })).toThrow(/--dry-run.*npm run lotes:construir -- --ensayo/);
  });

  it("no repite caracteres de control del usuario (ESC, saltos de línea) en el mensaje", () => {
    for (const x of ["\u001b[2J", "--a\nb", "--\u0007"]) {
      let mensaje = "";
      try {
        leer([x]);
      } catch (e) {
        mensaje = (e as Error).message;
      }
      expect(mensaje).toMatch(/desconocida/);
      expect(mensaje).not.toMatch(/[\u0000-\u001f\u007f]/);
    }
  });

  it("no repite valores largos del usuario en el mensaje", () => {
    expect(() => leer([`--${"x".repeat(500)}`])).toThrow(/^.{0,120}$/);
  });

  it("el uso nombra las dos opciones, el «--» de npm y las salidas", () => {
    expect(USO_CONSTRUIR).toContain("Uso: npm run lotes:construir");
    for (const t of ["--ensayo", "--ayuda", "-- --ensayo", "0 sin avisos", "3 con avisos", "2 uso", "1 error"]) expect(USO_CONSTRUIR).toContain(t);
  });
});
