import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { puntosDeNivel, rigeEnNivel, type ReglaDeNivel } from "@/analisis/puntos/nivel";
import { rigeHoy } from "@/operar/simulador/reglas";
import type { ReglaSimulada } from "@/operar/simulador/tipos";

const HOY = new Date("2027-03-10T00:00:00.000Z");
const D = (x: string) => new Prisma.Decimal(x);
const regla = (c: Partial<ReglaDeNivel> = {}): ReglaDeNivel => ({ id: "R1", instrumentoId: "FICTICIA-B", condicion: "CIERRE_BAJO", nivel: D("100"), plazoHasta: null, ...c });
const de = (r: ReglaDeNivel[], precio: string, id = "FICTICIA-B") => puntosDeNivel(r, id, D(precio), HOY);

describe("puntosDeNivel", () => {
  it("el precio del lado que toca el nivel da REGLA_TOCADA, con sujeto ORDEN", () => {
    expect(de([regla()], "99")).toEqual([
      { clave: "REGLA_TOCADA", sujeto: { tipo: "ORDEN", reglaId: "R1", instrumentoId: "FICTICIA-B" }, rango: "TOCADA", importancia: "ALTA", medido: 0 },
    ]);
    expect(de([regla({ condicion: "CIERRE_SOBRE" })], "101")[0]).toMatchObject({ clave: "REGLA_TOCADA" });
  });
  it("el precio igual al nivel da REGLA_EN_EL_NIVEL", () => {
    expect(de([regla()], "100")[0]).toMatchObject({ clave: "REGLA_EN_EL_NIVEL", rango: "EN_EL_NIVEL", importancia: "ALTA" });
  });
  it("a distancia, el rango sale de la distancia absoluta en por ciento", () => {
    expect(de([regla()], "100.5")[0]).toMatchObject({ clave: "REGLA_DISTANCIA", rango: "MUY_CERCA", importancia: "ALTA" });
    expect(de([regla()], "102")[0]).toMatchObject({ rango: "CERCA", importancia: "MEDIA" });
    expect(de([regla()], "104")[0]).toMatchObject({ rango: "EN_RANGO", importancia: "BAJA" });
    expect(de([regla()], "120")).toEqual([]);
  });
  it("LIBRE, MONTO_ORDEN_BAJO y NINGUNA no generan punto", () => {
    for (const condicion of ["LIBRE", "MONTO_ORDEN_BAJO", "NINGUNA"] as const) expect(de([regla({ condicion })], "99")).toEqual([]);
  });
  it("otra especie, regla de portafolio y regla vencida no cuentan; con plazo hoy sí", () => {
    expect(de([regla({ instrumentoId: "FICTICIA-A" }), regla({ instrumentoId: null })], "99")).toEqual([]);
    expect(de([regla({ plazoHasta: new Date("2027-03-09T00:00:00.000Z") })], "99")).toEqual([]);
    expect(de([regla({ plazoHasta: HOY })], "99")).toHaveLength(1);
  });
  it("es JSON puro y no muta la entrada", () => {
    const r = [regla()];
    const p = de(r, "99");
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
    expect(r[0]!.nivel!.eq(100)).toBe(true);
  });
  it("el valor medido es la distancia absoluta ya redondeada", () => {
    expect(de([regla()], "100.5")[0]!.medido).toBe(0.5);
    expect(de([regla({ condicion: "CIERRE_SOBRE", nivel: D("105") })], "100")[0]!.medido).toBe(5);
  });
});

describe("paridad con rigeHoy del simulador", () => {
  const dia = (d: string) => new Date(`${d}T00:00:00.000Z`);
  it.each([[null], ["2027-03-09"], ["2027-03-10"], ["2027-03-11"], ["2020-01-01"], ["2030-01-01"]])("plazo %s", (plazo) => {
    const plazoHasta = plazo === null ? null : dia(plazo);
    const simulada = { ...regla(), accion: "VENDER", cantidad: null, detalle: "", plazoHasta } as unknown as ReglaSimulada;
    expect(rigeEnNivel(regla({ plazoHasta }), HOY)).toBe(rigeHoy(simulada, HOY));
  });
});
