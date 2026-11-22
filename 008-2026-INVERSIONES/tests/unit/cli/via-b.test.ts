// La frase con que termina en producción todo fallo de un CLI de la vía B (§11 del runbook: si un paso no sale bien,
// se para y se avisa) es UNA: la de src/cli/via-b.ts. Hasta que src/cli/salida-escision.ts la importe de ahí (otro
// frente la toca), esta prueba exige que las dos digan lo mismo.
import { describe, expect, it } from "vitest";
import { PARE_VIA_B } from "@/cli/via-b";
import { salidaArgumentosInvalidos } from "@/cli/salida-escision";

describe("PARE_VIA_B", () => {
  it("pide parar la carga y avisar al CEO de 008", () => {
    expect(PARE_VIA_B).toMatch(/Vía B: pare la carga y avise al CEO de 008/);
  });

  it("es la misma frase con que terminan en producción los fallos de los CLI de escisión", () => {
    expect(salidaArgumentosInvalidos("x", { produccion: true }).errores.at(-1)).toBe(PARE_VIA_B);
  });
});
