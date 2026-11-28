// Qué tan cerca está cada regla de su nivel (fase B, corte 3). Puro. Informa; no recomienda. Datos inventados.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { estadoDelNivel } from "@/plan/niveles";

const D = (v: string) => new Prisma.Decimal(v);

describe("estado del nivel de una regla con el cierre al día", () => {
  it("CIERRE_BAJO se toca si el cierre queda por debajo del nivel (estricto)", () => {
    expect(estadoDelNivel("CIERRE_BAJO", D("2000"), D("1913"))).toEqual({ estado: "TOCADA", lado: "BAJO" });
    expect(estadoDelNivel("CIERRE_BAJO", D("2000"), D("2000"))).toEqual({ estado: "EN_EL_NIVEL" });
  });

  it("CIERRE_SOBRE se toca si el cierre queda por encima del nivel (estricto)", () => {
    expect(estadoDelNivel("CIERRE_SOBRE", D("1200"), D("1300"))).toEqual({ estado: "TOCADA", lado: "SOBRE" });
    expect(estadoDelNivel("CIERRE_SOBRE", D("1200.000000"), D("1200"))).toEqual({ estado: "EN_EL_NIVEL" });
  });

  it("si no se tocó, la distancia es lo que tendría que moverse el cierre para llegar al nivel, en %", () => {
    // (1.200 − 1.100) / 1.100 × 100 = 9,0909…; (480 − 505) / 505 × 100 = −4,9504…
    const sobre = estadoDelNivel("CIERRE_SOBRE", D("1200"), D("1100"));
    expect(sobre.estado === "A_DISTANCIA" && sobre.distanciaPct.toString()).toBe("9.09");
    const bajo = estadoDelNivel("CIERRE_BAJO", D("480"), D("505"));
    expect(bajo.estado === "A_DISTANCIA" && bajo.distanciaPct.toString()).toBe("-4.95");
  });

  it("las reglas sin nivel de precio no tienen distancia", () => {
    for (const c of ["NINGUNA", "LIBRE", "MONTO_ORDEN_BAJO"] as const) expect(estadoDelNivel(c, D("1000"), D("10"))).toEqual({ estado: "SIN_NIVEL" });
  });

  it("sin cierre al día (o sin nivel guardado) no se calcula la distancia", () => {
    expect(estadoDelNivel("CIERRE_BAJO", D("480"), null)).toEqual({ estado: "SIN_CIERRE_AL_DIA" });
    expect(estadoDelNivel("CIERRE_BAJO", null, D("505"))).toEqual({ estado: "SIN_NIVEL" });
  });

  it("un cierre en 0 (o negativo) no es un cierre al día: ni cruce falso ni distancia infinita, igual que un cierre ausente", () => {
    for (const c of [D("0"), D("-0"), D("-5")]) {
      expect(estadoDelNivel("CIERRE_BAJO", D("480"), c)).toEqual({ estado: "SIN_CIERRE_AL_DIA" });
      expect(estadoDelNivel("CIERRE_SOBRE", D("1200"), c)).toEqual({ estado: "SIN_CIERRE_AL_DIA" });
    }
  });
});
