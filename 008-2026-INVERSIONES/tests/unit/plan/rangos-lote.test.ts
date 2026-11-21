// Rango de cierres por especie del lote de resultados (database-reviewer MEDIO): cada especie lee solo los días que
// usan SUS decisiones, no el rango de todas. Puro. Datos inventados.
import { describe, expect, it } from "vitest";
import { rangosPorEspecie } from "@/plan/resultados-lote";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const decision = (instrumentoId: string, fecha: string, ordenes: string[] = []) => ({ instrumentoId, fechaDecision: dia(fecha), ordenes: ordenes.map((f) => ({ fechaOperacion: dia(f) })) });

describe("rangos de cierres por especie", () => {
  it("de la base más vieja − 7 días a la más reciente + 90, por especie (las órdenes también son bases)", () => {
    const r = rangosPorEspecie([decision("a", "2022-03-10"), decision("b", "2023-09-13", ["2023-09-15"]), decision("a", "2022-04-01", ["2022-04-04"])]);
    expect(r.get("a")).toEqual({ desde: dia("2022-03-03"), hasta: dia("2022-07-03") });
    expect(r.get("b")).toEqual({ desde: dia("2023-09-06"), hasta: dia("2023-12-14") });
  });

  it("sin decisiones no hay rangos", () => {
    expect(rangosPorEspecie([]).size).toBe(0);
  });
});
