// Argumentos y ayuda de scripts/registrar-rendimientos-fondo.ts (frente fondo-rendimientos, T2:
// src/fondo/rendimientos/argumentos.ts): estrictos, sin repetir la ruta, el correo ni el código del fondo, y la ayuda
// dice que la retención no mueve la caja. En producción, la ayuda de la vía B: sin `npx tsx`. Datos inventados.
import { describe, expect, it } from "vitest";
import { PARE_VIA_B } from "@/cli/via-b";
import {
  USO_RENDIMIENTOS, USO_VIA_B_RENDIMIENTOS, leerArgumentosRendimientos, salidaUsoRendimientos,
} from "@/fondo/rendimientos/argumentos";

const EMAIL = "dueno-rendimientos@ejemplo.invalid";
const RUTA = "/carpeta/privada/rendimientos-4613.ficticio.csv";
const FONDO = "4613927";
const BASE = ["--archivo", RUTA, "--email", EMAIL, "--fondo", FONDO];

describe("rendimientos · argumentos", () => {
  it("--archivo, --email y --fondo obligatorios; --aplicar opcional (sin él, ensayo); el correo sin espacios a los lados", () => {
    expect(leerArgumentosRendimientos(["--archivo", RUTA, "--email", ` ${EMAIL} `, "--fondo", FONDO])).toEqual({ ok: true, archivo: RUTA, email: EMAIL, codigoFic: FONDO, aplicar: false });
    expect(leerArgumentosRendimientos(["--aplicar", "--fondo", FONDO, "--email", EMAIL, "--archivo", RUTA])).toEqual({ ok: true, archivo: RUTA, email: EMAIL, codigoFic: FONDO, aplicar: true });
    expect(leerArgumentosRendimientos([`--archivo=${RUTA}`, `--email=${EMAIL}`, `--fondo=${FONDO}`])).toMatchObject({ ok: true, archivo: RUTA, codigoFic: FONDO });
  });

  it("lo que no se reconoce sale con su código y nunca repite la ruta, el correo ni el fondo", () => {
    const casos: [readonly string[], string][] = [
      [[], "FALTA_ARCHIVO"],
      [["--email", EMAIL, "--fondo", FONDO], "FALTA_ARCHIVO"],
      [["--archivo", RUTA, "--fondo", FONDO], "FALTA_EMAIL"],
      [["--archivo", RUTA, "--email", EMAIL], "FALTA_FONDO"],
      [[...BASE, "--archivo", RUTA], "OPCION_REPETIDA"],
      [[...BASE, "--fondo", "4613928"], "OPCION_REPETIDA"],
      [[...BASE, "--aplicar", "--aplicar"], "OPCION_REPETIDA"],
      [[...BASE, "suelto"], "ARGUMENTOS_INVALIDOS"],
      [[...BASE, "--"], "ARGUMENTOS_INVALIDOS"],
      [[...BASE, "--fecha-corte", "2027-11-19"], "ARGUMENTOS_INVALIDOS"],
      [[...BASE, "--aplicar=si"], "ARGUMENTOS_INVALIDOS"],
      [["--archivo", "--email", EMAIL, "--fondo", FONDO], "ARGUMENTOS_INVALIDOS"],
      [["--archivo=-x.csv", "--email", EMAIL, "--fondo", FONDO], "ARGUMENTOS_INVALIDOS"],
      [["--archivo", " ", "--email", EMAIL, "--fondo", FONDO], "FALTA_ARCHIVO"],
      [["--archivo", "/carpeta/rendimientos.txt", "--email", EMAIL, "--fondo", FONDO], "ARCHIVO_NO_CSV"],
      [["--archivo", RUTA, "--email", "no-es-correo", "--fondo", FONDO], "EMAIL_INVALIDO"],
      [["--archivo", RUTA, "--email=--d@x.invalid", "--fondo", FONDO], "EMAIL_INVALIDO"],
      [["--archivo", RUTA, "--email", EMAIL, "--fondo", "46A3927"], "FONDO_INVALIDO"],
      [["--archivo", RUTA, "--email", EMAIL, "--fondo", "4613927461392"], "FONDO_INVALIDO"],
      [["--archivo", RUTA, "--email", EMAIL, "--fondo=-4613927"], "FONDO_INVALIDO"],
      [["--archivo", RUTA, "--email", EMAIL, "--fondo", ""], "FONDO_INVALIDO"],
    ];
    for (const [argv, codigo] of casos) {
      const r = leerArgumentosRendimientos(argv);
      expect(r, argv.join(" ")).toEqual({ ok: false, codigo });
      expect(JSON.stringify(r)).not.toMatch(/ejemplo\.invalid|carpeta|4613/);
    }
  });

  it("la ayuda local y la de la vía B: el CSV, el ensayo, que la retención no mueve la caja y las salidas", () => {
    for (const uso of [USO_RENDIMIENTOS, USO_VIA_B_RENDIMIENTOS]) {
      expect(uso).toMatch(/fecha,tipo,valor/);
      expect(uso).toMatch(/RENDIMIENTO/);
      expect(uso).toMatch(/RETENCION/);
      expect(uso).toMatch(/no mueve la caja/);
      expect(uso).toMatch(/--aplicar/);
      expect(uso).toMatch(/0 bien · 1 .* · 2 .* · 3 rechazado/);
    }
    expect(USO_RENDIMIENTOS).toMatch(/npx tsx scripts\/registrar-rendimientos-fondo\.ts/);
    expect(USO_VIA_B_RENDIMIENTOS).not.toMatch(/npx|tsx/);
    expect(USO_VIA_B_RENDIMIENTOS).toMatch(/cargar-prod\.sh registrar-rendimientos-fondo/);
  });

  it("el uso inválido sale con 2 y la ayuda; en producción, la de la vía B y la frase de parar al final", () => {
    expect(salidaUsoRendimientos("FALTA_FONDO", { produccion: false })).toEqual({ codigoSalida: 2, lineas: [], errores: ["❌ argumentos · FALTA_FONDO", USO_RENDIMIENTOS] });
    expect(salidaUsoRendimientos("FALTA_FONDO", { produccion: true })).toEqual({
      codigoSalida: 2, lineas: [], errores: ["❌ argumentos · FALTA_FONDO", USO_VIA_B_RENDIMIENTOS, PARE_VIA_B],
    });
  });
});
