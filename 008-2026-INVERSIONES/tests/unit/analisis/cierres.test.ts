// El último cierre frente a la referencia (la regla de /plan) y el calendario armado desde los días no hábiles. Puro.
import { describe, expect, it } from "vitest";
import { calendarioDe, estadoCierre } from "@/analisis/cierres";
import { D, dia } from "./fixtures/portafolio.ficticio";

const calendario = calendarioDe([dia("2021-06-16"), dia("2020-06-17")]);
const cierre = (f: string) => ({ precio: D("1237.4"), fecha: dia(f), verificado: false });

describe("calendario", () => {
  it("los días no hábiles y los años que tienen alguno", () => {
    expect([...calendario.noHabiles]).toEqual(["2021-06-16", "2020-06-17"]);
    expect([...calendario.aniosCubiertos].sort()).toEqual([2020, 2021]);
  });
});

describe("estado del cierre", () => {
  it("sin cierre", () => {
    expect(estadoCierre(null, dia("2021-06-18"), calendario)).toEqual({ estado: "SIN_CIERRE" });
  });

  it("al día: el de la referencia o posterior, o sin referencia", () => {
    expect(estadoCierre(cierre("2021-06-18"), dia("2021-06-18"), calendario)).toEqual({ estado: "AL_DIA", dia: "2021-06-18", precio: D("1237.4") });
    expect(estadoCierre(cierre("2021-06-18"), dia("2021-06-17"), calendario).estado).toBe("AL_DIA");
    expect(estadoCierre(cierre("2021-06-15"), null, calendario).estado).toBe("AL_DIA");
  });

  it("sin negociación desde el primer día hábil sin cierre (el festivo no cuenta)", () => {
    expect(estadoCierre(cierre("2021-06-11"), dia("2021-06-18"), calendario)).toEqual({ estado: "SIN_NEGOCIACION", dia: "2021-06-11", precio: D("1237.4"), desde: "2021-06-14" });
    expect(estadoCierre(cierre("2021-06-15"), dia("2021-06-17"), calendario)).toMatchObject({ estado: "SIN_NEGOCIACION", desde: "2021-06-17" });
  });

  it("sin calendario del año del tramo", () => {
    expect(estadoCierre(cierre("2019-12-27"), dia("2019-12-31"), calendario)).toEqual({ estado: "SIN_CALENDARIO", dia: "2019-12-27", precio: D("1237.4"), anio: 2019 });
  });
});
