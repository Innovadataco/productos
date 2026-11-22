// Reglas del plan que la orden toca: el monto mínimo por orden, el precio del lado del nivel y otra acción de la
// misma especie. Solo las que rigen hoy. Información, nunca un juicio. Datos inventados.
import { describe, expect, it } from "vitest";
import { reglasAfectadas, rigeHoy } from "@/operar/simulador/reglas";
import type { ReglaSimulada } from "@/operar/simulador/tipos";
import { A, B, D, HOY, dia, idDe, operacion, regla } from "./apoyo/estado.ficticio";

const COMPRA_A = operacion(A, "COMPRAR", 37n, "4613.27");
const VALOR = D("170690.99");
const tipos = (reglas: readonly ReglaSimulada[], op = COMPRA_A, valor = VALOR) =>
  reglasAfectadas(reglas, op, valor, HOY).map((r) => [r.regla.id, r.afectaciones.map((a) => a.tipo)]);

describe("monto mínimo por orden (MONTO_ORDEN_BAJO)", () => {
  const minimo = (nivel: string, instrumentoId: string | null = null) => regla({ id: `monto-${nivel}`, condicion: "MONTO_ORDEN_BAJO", nivel: D(nivel), instrumentoId });

  it("por debajo del mínimo afecta, con el monto mínimo; igual o por encima no", () => {
    const r = reglasAfectadas([minimo("170691.01")], COMPRA_A, VALOR, HOY);
    expect(r).toHaveLength(1);
    const a = r[0]!.afectaciones[0];
    expect(a.tipo === "MONTO_ORDEN_BAJO" && a.montoMinimo.eq(D("170691.01"))).toBe(true);
    expect(tipos([minimo("170690.99"), minimo("4613.37")])).toEqual([]);
  });

  it("la de portafolio y la de la especie salen juntas; la de otra especie no", () => {
    expect(tipos([minimo("461337.41"), minimo("461337.43", idDe(A)), minimo("461337.47", idDe(B))])).toEqual([
      ["monto-461337.41", ["MONTO_ORDEN_BAJO"]],
      ["monto-461337.43", ["MONTO_ORDEN_BAJO"]],
    ]);
  });

  it("con «no actuar» de la especie no dice además «su plan dice no actuar»", () => {
    expect(tipos([minimo("461337.43", idDe(A))])).toEqual([["monto-461337.43", ["MONTO_ORDEN_BAJO"]]]);
  });
});

describe("precio del lado del nivel (CIERRE_BAJO y CIERRE_SOBRE)", () => {
  const cierre = (condicion: "CIERRE_BAJO" | "CIERRE_SOBRE", nivel: string) =>
    regla({ id: `${condicion}-${nivel}`, condicion, nivel: D(nivel), instrumentoId: idDe(A), accion: "COMPRAR", cantidad: 37n });

  it("bajo el nivel en CIERRE_BAJO y sobre el nivel en CIERRE_SOBRE: tocada, con su lado", () => {
    const r = reglasAfectadas([cierre("CIERRE_BAJO", "4613.29"), cierre("CIERRE_SOBRE", "4613.23")], COMPRA_A, VALOR, HOY);
    expect(r.map((x) => x.afectaciones[0])).toEqual([
      { tipo: "PRECIO_DEL_LADO_DEL_NIVEL", frente: { estado: "TOCADA", lado: "BAJO" } },
      { tipo: "PRECIO_DEL_LADO_DEL_NIVEL", frente: { estado: "TOCADA", lado: "SOBRE" } },
    ]);
  });

  it("en el nivel exacto: EN_EL_NIVEL", () => {
    const r = reglasAfectadas([cierre("CIERRE_SOBRE", "4613.27")], COMPRA_A, VALOR, HOY);
    expect(r[0]!.afectaciones).toEqual([{ tipo: "PRECIO_DEL_LADO_DEL_NIVEL", frente: { estado: "EN_EL_NIVEL" } }]);
  });

  it("del otro lado del nivel no afecta", () => {
    expect(tipos([cierre("CIERRE_BAJO", "4613.23"), cierre("CIERRE_SOBRE", "4613.29")])).toEqual([]);
  });

  it("una regla de cierre de portafolio o de otra especie no se evalúa contra este precio", () => {
    const portafolio = regla({ id: "port", condicion: "CIERRE_BAJO", nivel: D("9137.11"), instrumentoId: null });
    const otra = regla({ id: "otra", condicion: "CIERRE_BAJO", nivel: D("9137.11"), instrumentoId: idDe(B) });
    expect(tipos([portafolio, otra])).toEqual([]);
  });
});

describe("otra acción de la misma especie (OTRA_ACCION)", () => {
  it("una regla de la especie con otra acción dice cuál, también «no actuar» y LIBRE", () => {
    const r = reglasAfectadas(
      [
        regla({ id: "vende", instrumentoId: idDe(A), accion: "VENDER", cantidad: 41n }),
        regla({ id: "quieto", instrumentoId: idDe(A), accion: "NO_ACTUAR", cantidad: 1237n }),
        regla({ id: "escrita", instrumentoId: idDe(A), condicion: "LIBRE", accion: "NO_ACTUAR" }),
      ],
      COMPRA_A,
      VALOR,
      HOY,
    );
    expect(r.map((x) => x.afectaciones)).toEqual([
      [{ tipo: "OTRA_ACCION", accionDelPlan: "VENDER" }],
      [{ tipo: "OTRA_ACCION", accionDelPlan: "NO_ACTUAR" }],
      [{ tipo: "OTRA_ACCION", accionDelPlan: "NO_ACTUAR" }],
    ]);
  });

  it("la misma acción no afecta; la de portafolio o de otra especie, tampoco", () => {
    expect(
      tipos([
        regla({ id: "igual", instrumentoId: idDe(A), accion: "COMPRAR", cantidad: 37n }),
        regla({ id: "port", instrumentoId: null, accion: "VENDER", condicion: "LIBRE" }),
        regla({ id: "otra", instrumentoId: idDe(B), accion: "VENDER" }),
      ]),
    ).toEqual([]);
  });

  it("una regla de cierre con otra acción y el precio de su lado da las dos afectaciones", () => {
    const r = regla({ id: "doble", instrumentoId: idDe(A), condicion: "CIERRE_SOBRE", nivel: D("4613.23"), accion: "VENDER", cantidad: 41n });
    expect(tipos([r])).toEqual([["doble", ["PRECIO_DEL_LADO_DEL_NIVEL", "OTRA_ACCION"]]]);
  });

  it("vender cuando el plan de la especie dice comprar", () => {
    const venta = operacion(A, "VENDER", 37n, "4613.27");
    expect(tipos([regla({ id: "compra", instrumentoId: idDe(A), accion: "COMPRAR", cantidad: 37n })], venta)).toEqual([["compra", ["OTRA_ACCION"]]]);
  });
});

describe("solo las reglas que rigen hoy", () => {
  it("sin plazo o con plazo hoy o después rige; con plazo vencido no", () => {
    expect(rigeHoy(regla({ plazoHasta: null }), HOY)).toBe(true);
    expect(rigeHoy(regla({ plazoHasta: HOY }), HOY)).toBe(true);
    expect(rigeHoy(regla({ plazoHasta: dia("2027-11-23") }), HOY)).toBe(true);
    expect(rigeHoy(regla({ plazoHasta: dia("2027-03-16") }), HOY)).toBe(false);
  });

  it("una regla vencida no sale aunque la orden la toque", () => {
    expect(tipos([regla({ id: "vencida", instrumentoId: idDe(A), accion: "VENDER", plazoHasta: dia("2027-03-16") })])).toEqual([]);
  });

  it("las afectadas salen en el orden del plan, cada una con su regla tal cual", () => {
    const r1 = regla({ id: "r1", instrumentoId: idDe(A), accion: "VENDER", detalle: "lo que escribió, ficticio" });
    const r2 = regla({ id: "r2", condicion: "MONTO_ORDEN_BAJO", nivel: D("461337.41") });
    const r = reglasAfectadas([r1, r2], COMPRA_A, VALOR, HOY);
    expect(r.map((x) => x.regla)).toEqual([r1, r2]);
  });
});
