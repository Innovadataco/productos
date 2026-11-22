// Argumentos y ayuda de scripts/importar-decretos.ts (fase C, C4a: src/datos-oficiales/decretos/argumentos.ts):
// estrictos, sin repetir la ruta ni el correo, y la ayuda dice la condición que dejó C1 (no cargar decretos reales
// hasta el cruce por ventana, C5b). En producción, la ayuda de la vía B: sin `npx tsx`. Datos inventados.
import { describe, expect, it } from "vitest";
import { PARE_VIA_B } from "@/cli/via-b";
import { USO_IMPORTAR_DECRETOS, USO_VIA_B_DECRETOS, leerArgumentosDecretos, salidaUso } from "@/datos-oficiales/decretos/argumentos";

const EMAIL = "dueno-decretos@ejemplo.invalid";
const RUTA = "/carpeta/privada/decretos-4613.ficticio.csv";

describe("decretos · argumentos", () => {
  it("--archivo y --email obligatorios; --aplicar opcional (sin él, ensayo); el correo sin espacios a los lados", () => {
    expect(leerArgumentosDecretos(["--archivo", RUTA, "--email", ` ${EMAIL} `])).toEqual({ ok: true, archivo: RUTA, email: EMAIL, aplicar: false });
    expect(leerArgumentosDecretos(["--aplicar", "--email", EMAIL, "--archivo", RUTA])).toEqual({ ok: true, archivo: RUTA, email: EMAIL, aplicar: true });
    expect(leerArgumentosDecretos([`--archivo=${RUTA}`, `--email=${EMAIL}`])).toMatchObject({ ok: true, archivo: RUTA });
  });

  it("lo que no se reconoce sale con su código y nunca repite la ruta ni el correo", () => {
    const casos: [readonly string[], string][] = [
      [["--email", EMAIL], "FALTA_ARCHIVO"],
      [["--archivo", RUTA], "FALTA_EMAIL"],
      [["--archivo", RUTA, "--email", EMAIL, "--archivo", RUTA], "OPCION_REPETIDA"],
      [["--archivo", RUTA, "--email", EMAIL, "--aplicar", "--aplicar"], "OPCION_REPETIDA"],
      [["--archivo", RUTA, "--email", EMAIL, "suelto"], "ARGUMENTOS_INVALIDOS"],
      [["--archivo", RUTA, "--email", EMAIL, "--"], "ARGUMENTOS_INVALIDOS"],
      [["--archivo", RUTA, "--email", EMAIL, "--base", "x"], "ARGUMENTOS_INVALIDOS"],
      [["--archivo", RUTA, "--email", EMAIL, "--aplicar=si"], "ARGUMENTOS_INVALIDOS"],
      [["--archivo", "--email", EMAIL], "ARGUMENTOS_INVALIDOS"],
      [["--archivo=-x.csv", "--email", EMAIL], "ARGUMENTOS_INVALIDOS"],
      [["--archivo", "/carpeta/decretos.txt", "--email", EMAIL], "ARCHIVO_NO_CSV"],
      [["--archivo", " ", "--email", EMAIL], "FALTA_ARCHIVO"],
      [["--archivo", RUTA, "--email", "no-es-correo"], "EMAIL_INVALIDO"],
      [["--archivo", RUTA, "--email=--d@x.invalid"], "EMAIL_INVALIDO"],
      [["--archivo", RUTA, "--email", "d\u202e@x.invalid"], "EMAIL_INVALIDO"],
      [[], "FALTA_ARCHIVO"],
    ];
    for (const [argv, codigo] of casos) {
      const r = leerArgumentosDecretos(argv);
      expect(r, argv.join(" ")).toEqual({ ok: false, codigo });
      const s = salidaUso(codigo as never, { produccion: false });
      expect(s.codigoSalida).toBe(2);
      expect(s.errores.join("\n")).not.toContain(EMAIL);
      expect(s.errores.join("\n")).not.toContain("4613");
    }
  });
});

describe("decretos · ayuda", () => {
  it("dice el comando, el ensayo, las salidas y la condición de C1 (no cargar decretos reales hasta C5b)", () => {
    for (const texto of [USO_IMPORTAR_DECRETOS, USO_VIA_B_DECRETOS]) {
      expect(texto).toMatch(/NO cargue decretos reales/);
      expect(texto).toMatch(/C5b/);
      expect(texto).toMatch(/dos veces/);
      expect(texto).toMatch(/CRUCE_PENDIENTE/);
      expect(texto).toMatch(/0 bien · 1 .* · 2 .* · 3 rechazado/);
      expect(texto).not.toMatch(/\b(compr[ae]|vend[ae]|recomendamos)\b/i);
    }
    expect(USO_IMPORTAR_DECRETOS).toContain("npx tsx scripts/importar-decretos.ts --archivo <decretos.csv> --email <correo-del-dueño> [--aplicar]");
    expect(USO_VIA_B_DECRETOS).not.toContain("npx tsx");
  });

  it("el uso inválido sale con 2 y la ayuda; en producción, la de la vía B y la frase de parar la carga", () => {
    const local = salidaUso("FALTA_EMAIL", { produccion: false });
    expect(local).toEqual({ codigoSalida: 2, lineas: [], errores: ["❌ argumentos · FALTA_EMAIL", USO_IMPORTAR_DECRETOS] });
    const prod = salidaUso("FALTA_EMAIL", { produccion: true });
    expect(prod.errores).toEqual(["❌ argumentos · FALTA_EMAIL", USO_VIA_B_DECRETOS, PARE_VIA_B]);
  });
});
