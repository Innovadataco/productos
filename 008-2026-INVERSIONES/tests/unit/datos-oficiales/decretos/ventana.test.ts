// La ventana del cruce de un decreto con los pagos de Trii (fase C, C5b: src/datos-oficiales/decretos/ventana.ts): días
// calendario alrededor de la fecha de pago del decreto, con los dos bordes incluidos. La comparten el cruce y el motor de
// proyecciones, así que es pura (solo fechas). Datos inventados.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  VENTANA_PAGO_ANTES_DIAS, VENTANA_PAGO_DESPUES_DIAS, enVentanaDePago, finVentana, inicioVentana,
} from "@/datos-oficiales/decretos/ventana";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const PAGO = dia("2027-03-17");
const FUENTE = path.join(__dirname, "..", "..", "..", "..", "src", "datos-oficiales", "decretos", "ventana.ts");

describe("decretos · ventana de pago del cruce", () => {
  it("va de 3 días antes a 10 días después de la fecha de pago del decreto (días calendario)", () => {
    expect([VENTANA_PAGO_ANTES_DIAS, VENTANA_PAGO_DESPUES_DIAS]).toEqual([3, 10]);
    expect(inicioVentana(PAGO)).toEqual(dia("2027-03-14"));
    expect(finVentana(PAGO)).toEqual(dia("2027-03-27"));
  });

  it("los dos bordes cuentan; un día más afuera, no", () => {
    for (const d of ["2027-03-14", "2027-03-17", "2027-03-27"]) expect(enVentanaDePago(PAGO, dia(d)), d).toBe(true);
    for (const d of ["2027-03-13", "2027-03-28"]) expect(enVentanaDePago(PAGO, dia(d)), d).toBe(false);
  });

  it("es pura: con valor solo importa las fechas del plan (el motor de proyecciones la importa)", () => {
    const importaciones = [...readFileSync(FUENTE, "utf8").matchAll(/^(?:import|export)\s+(?!type\b)(?:[^"';()=]*?from\s+)?["']([^"']+)["']/gm)].map((m) => m[1]);
    expect(importaciones).toEqual(["../../plan/fechas"]);
  });
});
