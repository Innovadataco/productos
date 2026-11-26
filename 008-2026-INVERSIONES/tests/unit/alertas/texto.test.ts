import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { claveDeAlerta, type Alerta } from "@/alertas/tipos";
import { textoDeAlerta } from "@/alertas/texto";

const D = (v: string) => new Prisma.Decimal(v);
const alerta = (o: Partial<Alerta> & Pick<Alerta, "tipo">): Alerta => ({
  clave: claveDeAlerta("2027-03-01", o.tipo, "FICTICIA-A", null, null), dia: "2027-03-01", instrumentoId: "FICTICIA-A", reglaId: null, sentido: null, base: null, datos: {}, ...o,
});
const barra = new Date("2027-03-01T15:35:00Z"); // 10:35 en Colombia

describe("textoDeAlerta", () => {
  it("el intradía dice la hora de la barra en hora de Colombia y el retraso, nunca «ahora»", () => {
    const t = textoDeAlerta(alerta({ tipo: "NIVEL_CRUZADO", sentido: "BAJO", base: "INTRADIA", datos: { nivel: D("100"), precio: D("95.5"), instante: barra, conRetraso: true } }), "FICTICIA-A");
    expect(t).toContain("10:35");
    expect(t).toContain("hora de Colombia");
    expect(t).toMatch(/retraso/);
    expect(t).toContain("por debajo");
    expect(t).toContain("95,5");
    expect(t).not.toMatch(/ahora/i);
  });
  it("sin retraso no lo menciona; el cierre habla del cierre del día", () => {
    const sin = textoDeAlerta(alerta({ tipo: "NIVEL_CRUZADO", sentido: "SOBRE", base: "INTRADIA", datos: { nivel: D("100"), precio: D("105"), instante: barra, conRetraso: false } }), "FICTICIA-A");
    expect(sin).not.toMatch(/retraso/);
    expect(sin).toContain("por encima");
    expect(textoDeAlerta(alerta({ tipo: "NIVEL_CRUZADO", sentido: "SOBRE", base: "CIERRE", datos: { nivel: D("100"), precio: D("105") } }), "FICTICIA-A")).toContain("cierre del día");
  });
  it("cerca: dice la distancia; en el nivel: lo dice", () => {
    expect(textoDeAlerta(alerta({ tipo: "NIVEL_CERCA", sentido: "BAJO", base: "CIERRE", datos: { nivel: D("100"), precio: D("102"), distanciaPct: D("1.96") } }), "FICTICIA-A")).toContain("1,96 %");
    expect(textoDeAlerta(alerta({ tipo: "NIVEL_CERCA", sentido: "BAJO", base: "CIERRE", datos: { nivel: D("100"), precio: D("100") } }), "FICTICIA-A")).toContain("en el nivel");
  });
  it("el movimiento dice el sentido y, si es la fecha ex, lo explica", () => {
    const m = (esFechaEx: boolean) => textoDeAlerta(alerta({ tipo: "MOVIMIENTO_DIA", sentido: "BAJO", base: "CIERRE", datos: { precio: D("96"), variacionPct: D("-4"), esFechaEx } }), "FICTICIA-A");
    expect(m(false)).toContain("4 % por debajo del cierre anterior");
    expect(m(false)).not.toMatch(/fecha ex/);
    expect(m(true)).toMatch(/fecha ex/);
    expect(textoDeAlerta(alerta({ tipo: "MOVIMIENTO_DIA", sentido: "SOBRE", base: "CIERRE", datos: { precio: D("104"), variacionPct: D("4") } }), "FICTICIA-A")).toContain("por encima del cierre anterior");
  });
  it("la caída del portafolio dice la base", () => {
    expect(textoDeAlerta(alerta({ tipo: "CAIDA_PORTAFOLIO", instrumentoId: null, sentido: "BAJO", base: "CIERRE", datos: { variacionPct: D("-2.5") } }), "")).toContain("2,5 %");
    expect(textoDeAlerta(alerta({ tipo: "CAIDA_PORTAFOLIO", instrumentoId: null, sentido: "BAJO", base: "INTRADIA", datos: { variacionPct: D("-2") } }), "")).toMatch(/barras intradía/);
  });
  it("dato viejo: la hora de la última barra, los minutos y el límite; o que falta el dato", () => {
    const t = textoDeAlerta(alerta({ tipo: "DATO_VIEJO", base: "INTRADIA", datos: { instante: barra, minutosDeEdad: 61, umbralMin: 50, conRetraso: false } }), "FICTICIA-A");
    expect(t).toContain("10:35");
    expect(t).toContain("61 minutos");
    expect(t).toContain("50");
    expect(textoDeAlerta(alerta({ tipo: "DATO_VIEJO", base: "INTRADIA", datos: { minutosDeEdad: 55, umbralMin: 50 } }), "FICTICIA-A")).toMatch(/no hay ninguna barra de hoy/);
    expect(textoDeAlerta(alerta({ tipo: "DATO_VIEJO", base: "CIERRE", datos: {} }), "FICTICIA-A")).toMatch(/falta el cierre de hoy/);
  });
  it("fecha ex: hoy o en una fecha, con el pago previsto", () => {
    const hoy = textoDeAlerta(alerta({ tipo: "FECHA_EX", datos: { fechaEx: new Date("2027-03-01T00:00:00Z"), fechaPago: new Date("2027-04-15T00:00:00Z"), esFechaEx: true } }), "FICTICIA-A");
    expect(hoy).toContain("es hoy");
    expect(hoy).toContain("2027-04-15");
    expect(textoDeAlerta(alerta({ tipo: "FECHA_EX", datos: { fechaEx: new Date("2027-03-03T00:00:00Z"), fechaPago: new Date("2027-04-15T00:00:00Z"), esFechaEx: false } }), "FICTICIA-A")).toContain("es el 2027-03-03");
  });
  it("lleva la especie por delante", () => {
    expect(textoDeAlerta(alerta({ tipo: "DATO_VIEJO", base: "CIERRE", datos: {} }), "FICTICIA-A")).toMatch(/^FICTICIA-A/);
  });
  it("con datos incompletos escribe «?» en vez de fallar", () => {
    expect(textoDeAlerta(alerta({ tipo: "NIVEL_CRUZADO", sentido: "BAJO", base: "CIERRE", datos: {} }), "FICTICIA-A")).toContain("(?)");
    expect(textoDeAlerta(alerta({ tipo: "MOVIMIENTO_DIA", sentido: "BAJO", base: "CIERRE", datos: {} }), "FICTICIA-A")).toContain("? por debajo");
    expect(textoDeAlerta(alerta({ tipo: "DATO_VIEJO", base: "INTRADIA", datos: { instante: barra } }), "FICTICIA-A")).toContain("lleva ? minutos");
    expect(textoDeAlerta(alerta({ tipo: "FECHA_EX", datos: {} }), "FICTICIA-A")).toBe("FICTICIA-A: la fecha ex del decreto es el ?.");
    expect(textoDeAlerta(alerta({ tipo: "NIVEL_CRUZADO", sentido: "BAJO", base: "INTRADIA", datos: { precio: D("1") } }), "FICTICIA-A")).toContain("la última barra intradía");
  });
});
