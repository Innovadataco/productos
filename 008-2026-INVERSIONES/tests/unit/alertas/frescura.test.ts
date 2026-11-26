import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { evaluarFrescura, type EntradaFrescura } from "@/alertas/evaluar/frescura";
import { UMBRALES_OMISION } from "@/alertas/umbrales";

// 2027-03-01 es lunes. Hora de Colombia = UTC − 5.
const cot = (dia: string, hhmm: string): Date => new Date(`${dia}T${hhmm}:00-05:00`);
const barra = (dia: string, hhmm: string) => ({ instante: cot(dia, hhmm), precio: new Prisma.Decimal("10"), conRetraso: false });
const entrada = (ahora: Date, o: Partial<EntradaFrescura> = {}): EntradaFrescura => ({
  dia: "2027-03-01", ahora, instrumentoId: "FICTICIA-A", intradiaActivo: true, ultimo: null, cierreDeHoy: false, noHabiles: new Set(), ...o,
});

describe("evaluarFrescura con el intradía activo", () => {
  it("es viejo después de 30 min más 20 de retraso: 50 min no salta, 51 sí", () => {
    const u = barra("2027-03-01", "11:00");
    expect(evaluarFrescura(entrada(cot("2027-03-01", "11:50"), { ultimo: u }), UMBRALES_OMISION)).toBeNull();
    expect(evaluarFrescura(entrada(cot("2027-03-01", "11:51"), { ultimo: u }), UMBRALES_OMISION)).toMatchObject({ tipo: "DATO_VIEJO", base: "INTRADIA", sentido: null, datos: { minutosDeEdad: 51, umbralMin: 50 } });
  });
  it("respeta el umbral configurado", () => {
    const u = barra("2027-03-01", "11:00");
    expect(evaluarFrescura(entrada(cot("2027-03-01", "11:40"), { ultimo: u }), { ...UMBRALES_OMISION, alertaDatoViejoMin: 10 })).not.toBeNull();
  });
  it("fuera de la rueda no salta: antes de abrir, después de cerrar, fin de semana y festivo", () => {
    expect(evaluarFrescura(entrada(cot("2027-03-01", "09:00")), UMBRALES_OMISION)).toBeNull();
    expect(evaluarFrescura(entrada(cot("2027-03-01", "16:01")), UMBRALES_OMISION)).toBeNull();
    expect(evaluarFrescura(entrada(cot("2027-03-06", "12:00"), { dia: "2027-03-06" }), UMBRALES_OMISION)).toBeNull();
    expect(evaluarFrescura(entrada(cot("2027-03-01", "12:00"), { noHabiles: new Set(["2027-03-01"]) }), UMBRALES_OMISION)).toBeNull();
  });
  it("una barra de ayer no es vieja apenas abre la rueda: la edad cuenta desde la apertura", () => {
    const ayer = barra("2027-02-26", "15:55");
    expect(evaluarFrescura(entrada(cot("2027-03-01", "09:40"), { ultimo: ayer }), UMBRALES_OMISION)).toBeNull();
    expect(evaluarFrescura(entrada(cot("2027-03-01", "10:21"), { ultimo: ayer }), UMBRALES_OMISION)).not.toBeNull();
  });
  it("sin ninguna barra, salta pasados 50 min de la apertura", () => {
    expect(evaluarFrescura(entrada(cot("2027-03-01", "10:20")), UMBRALES_OMISION)).toBeNull();
    expect(evaluarFrescura(entrada(cot("2027-03-01", "10:21")), UMBRALES_OMISION)).not.toBeNull();
  });
  it("una barra del futuro no apaga la alerta: se ignora", () => {
    const futura = { instante: new Date("2099-01-01T00:00:00Z"), precio: new Prisma.Decimal("10"), conRetraso: false };
    const a = evaluarFrescura(entrada(cot("2027-03-01", "14:00"), { ultimo: futura }), UMBRALES_OMISION);
    expect(a).toMatchObject({ tipo: "DATO_VIEJO", base: "INTRADIA", datos: { instante: undefined } });
  });
  it("el interruptor lo apaga", () => {
    expect(evaluarFrescura(entrada(cot("2027-03-01", "14:00")), { ...UMBRALES_OMISION, alertaDatoViejoActiva: false })).toBeNull();
  });
});

describe("evaluarFrescura: falta el cierre con el intradía encendido", () => {
  const encendido = (hhmm: string, o: Partial<EntradaFrescura> = {}) => entrada(cot("2027-03-01", hhmm), { ultimo: barra("2027-03-01", "15:59"), ...o });
  it("después de las 18:15 sin el cierre de hoy salta con base cierre; a las 18:14, no", () => {
    expect(evaluarFrescura(encendido("18:14"), UMBRALES_OMISION)).toBeNull();
    expect(evaluarFrescura(encendido("18:15"), UMBRALES_OMISION)).toMatchObject({ tipo: "DATO_VIEJO", base: "CIERRE" });
  });
  it("«dato viejo del intradía» y «falta el cierre» el mismo día no comparten clave: se distinguen por el sentido", () => {
    const u = barra("2027-03-01", "11:00");
    const rueda = evaluarFrescura(entrada(cot("2027-03-01", "14:00"), { ultimo: u }), UMBRALES_OMISION);
    const cierre = evaluarFrescura(entrada(cot("2027-03-01", "18:30"), { ultimo: u }), UMBRALES_OMISION);
    expect(rueda).toMatchObject({ sentido: "RUEDA", base: "INTRADIA" });
    expect(cierre).toMatchObject({ sentido: "CIERRE_FALTANTE", base: "CIERRE" });
    expect(rueda!.clave).not.toBe(cierre!.clave);
    expect(rueda!.clave).toBe("2027-03-01|DATO_VIEJO|FICTICIA-A|-|RUEDA");
    expect(cierre!.clave).toBe("2027-03-01|DATO_VIEJO|FICTICIA-A|-|CIERRE_FALTANTE");
  });
  it("con el cierre de hoy, en día no hábil o con el interruptor apagado, no salta", () => {
    expect(evaluarFrescura(encendido("19:00", { cierreDeHoy: true }), UMBRALES_OMISION)).toBeNull();
    expect(evaluarFrescura(encendido("19:00", { noHabiles: new Set(["2027-03-01"]) }), UMBRALES_OMISION)).toBeNull();
    expect(evaluarFrescura(encendido("19:00"), { ...UMBRALES_OMISION, alertaDatoViejoActiva: false })).toBeNull();
  });
});

describe("evaluarFrescura con el intradía apagado", () => {
  const apagado = (hhmm: string, o: Partial<EntradaFrescura> = {}) => entrada(cot("2027-03-01", hhmm), { intradiaActivo: false, ...o });
  it("falta el cierre del día hábil a las 18:00: salta; antes, no", () => {
    expect(evaluarFrescura(apagado("17:59"), UMBRALES_OMISION)).toBeNull();
    expect(evaluarFrescura(apagado("18:00"), UMBRALES_OMISION)).toMatchObject({ tipo: "DATO_VIEJO", base: "CIERRE" });
  });
  it("con el cierre del día, no salta", () => {
    expect(evaluarFrescura(apagado("19:00", { cierreDeHoy: true }), UMBRALES_OMISION)).toBeNull();
  });
  it("en día no hábil no salta", () => {
    expect(evaluarFrescura(apagado("19:00", { noHabiles: new Set(["2027-03-01"]) }), UMBRALES_OMISION)).toBeNull();
  });
});
