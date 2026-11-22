/**
 * Señal 2 del corte real (frente certificacion-corte-real): el PDF de A&V trae su CreationDate con hora y huso. Si
 * se generó el MISMO día del corte pedido antes de que el cierre de ese día fuera definitivo (la hora de los
 * precios, HORA_BARRA_DEFINITIVA_COT), no puede ser al cierre de ese día: se rechaza (FECHA_CORTE_ANTES_DEL_CIERRE).
 * Con un corte posterior al día de creación sigue FECHA_CORTE_POSTERIOR_AL_PDF. Los dos sugieren el último día hábil
 * cuyo cierre ya era definitivo al generarse el PDF (`ultimoCorteDefinitivo`). Sin CreationDate no bloquea.
 * Calendario y fechas inventados de 2027 (y 2021, sin sembrar).
 */
import { describe, expect, it } from "vitest";
import { calendarioDe, ultimoCorteDefinitivo, validarFechaCorte, type CalendarioCorte } from "@/importacion/av/fecha-corte";
import { HORA_BARRA_DEFINITIVA_COT } from "@/precios/horario";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);
/** Hora de Colombia (UTC−5) → instante. */
const cot = (s: string, hhmm: string) => new Date(`${s}T${hhmm}:00-05:00`);
const FESTIVOS_2027 = ["2027-01-01", "2027-01-11", "2027-08-16", "2027-10-18", "2027-12-08"];
const CAL = (): CalendarioCorte => calendarioDe(FESTIVOS_2027.map(dia));
const ctx = (creadoEn: Date | null) => ({ ...CAL(), hoy: cot("2027-08-20", "09:41"), creadoEn });

describe("validarFechaCorte · señal 2 (hora de creación del PDF)", () => {
  it("la hora definitiva es la de los precios (17:00 COT), no una nueva", () => {
    expect(HORA_BARRA_DEFINITIVA_COT).toEqual({ hora: 17, minuto: 0 });
  });

  it("generado el mismo día del corte antes del cierre definitivo → FECHA_CORTE_ANTES_DEL_CIERRE", () => {
    expect(validarFechaCorte(dia("2027-08-04"), ctx(cot("2027-08-04", "14:35")))).toBe("FECHA_CORTE_ANTES_DEL_CIERRE");
    expect(validarFechaCorte(dia("2027-08-04"), ctx(cot("2027-08-04", "16:59")))).toBe("FECHA_CORTE_ANTES_DEL_CIERRE");
    expect(validarFechaCorte(dia("2027-08-04"), ctx(cot("2027-08-04", "00:07")))).toBe("FECHA_CORTE_ANTES_DEL_CIERRE");
  });

  it("generado el mismo día desde la hora definitiva → se acepta", () => {
    expect(validarFechaCorte(dia("2027-08-04"), ctx(cot("2027-08-04", "17:00")))).toBeNull();
    expect(validarFechaCorte(dia("2027-08-04"), ctx(cot("2027-08-04", "23:13")))).toBeNull();
  });

  it("generado después del día del corte (aunque sea temprano) → se acepta; posterior al PDF sigue con su código", () => {
    expect(validarFechaCorte(dia("2027-08-03"), ctx(cot("2027-08-04", "08:19")))).toBeNull();
    expect(validarFechaCorte(dia("2027-08-05"), ctx(cot("2027-08-04", "18:02")))).toBe("FECHA_CORTE_POSTERIOR_AL_PDF");
  });

  it("sin CreationDate (o ilegible) la señal no bloquea", () => {
    expect(validarFechaCorte(dia("2027-08-04"), ctx(null))).toBeNull();
  });

  it("un corte no hábil sigue diciendo FECHA_CORTE_NO_HABIL antes que la hora", () => {
    expect(validarFechaCorte(dia("2027-08-16"), ctx(cot("2027-08-16", "10:15")))).toBe("FECHA_CORTE_NO_HABIL");
  });
});

describe("ultimoCorteDefinitivo (el día que se sugiere)", () => {
  it("generado un día hábil desde la hora definitiva → ese mismo día", () => {
    expect(ultimoCorteDefinitivo(cot("2027-08-04", "17:03"), CAL())).toEqual({ ok: true, dia: "2027-08-04" });
  });

  it("generado un día hábil antes de la hora definitiva → el día hábil anterior", () => {
    expect(ultimoCorteDefinitivo(cot("2027-08-04", "14:35"), CAL())).toEqual({ ok: true, dia: "2027-08-03" });
  });

  it("generado en fin de semana o en un festivo, a cualquier hora → el último día hábil anterior", () => {
    expect(ultimoCorteDefinitivo(cot("2027-08-14", "20:11"), CAL())).toEqual({ ok: true, dia: "2027-08-13" });
    expect(ultimoCorteDefinitivo(cot("2027-08-16", "18:47"), CAL())).toEqual({ ok: true, dia: "2027-08-13" });
  });

  it("la fecha se toma en hora de Colombia: las 21:30 COT del 4 son el 5 en UTC, pero el día es el 4", () => {
    expect(ultimoCorteDefinitivo(new Date("2027-08-05T02:30:00Z"), CAL())).toEqual({ ok: true, dia: "2027-08-04" });
  });

  it("no adivina: un año sin calendario sembrado devuelve ese año", () => {
    expect(ultimoCorteDefinitivo(cot("2021-06-14", "18:20"), CAL())).toEqual({ ok: false, anioSinCalendario: 2021 });
    expect(ultimoCorteDefinitivo(cot("2027-01-01", "11:00"), CAL())).toEqual({ ok: false, anioSinCalendario: 2026 });
  });
});
