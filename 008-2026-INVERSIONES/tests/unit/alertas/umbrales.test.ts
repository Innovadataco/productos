import { describe, expect, it } from "vitest";
import { RANGOS_UMBRALES, UMBRALES_OMISION, validarUmbrales } from "@/alertas/umbrales";

describe("umbrales de alertas", () => {
  it("la omisión es la definida y todas las alertas vienen activas", () => {
    expect(UMBRALES_OMISION).toEqual({
      alertaCercaPct: 3, alertaCercaActiva: true,
      alertaNivelCruzadoActiva: true,
      alertaMovimientoPct: 3, alertaMovimientoActiva: true,
      alertaCaidaPct: 2, alertaCaidaActiva: true,
      alertaDatoViejoMin: 30, alertaDatoViejoActiva: true,
      alertaExDiasHabiles: 3, alertaExActiva: true,
    });
    expect(Object.isFrozen(UMBRALES_OMISION)).toBe(true);
  });

  it("sin entrada (null, undefined o vacía) devuelve la omisión", () => {
    for (const e of [null, undefined, {}]) expect(validarUmbrales(e)).toEqual({ ok: true, umbrales: UMBRALES_OMISION });
  });

  it("acepta los bordes de cada rango", () => {
    for (const [campo, { min, max }] of Object.entries(RANGOS_UMBRALES)) {
      for (const v of [min, max]) {
        const r = validarUmbrales({ [campo]: v });
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.umbrales[campo as keyof typeof r.umbrales]).toBe(v);
      }
    }
  });

  it("rechaza un valor justo fuera de cada rango", () => {
    for (const [campo, { min, max }] of Object.entries(RANGOS_UMBRALES)) {
      for (const v of [min - 0.01, max + 0.01]) {
        const r = validarUmbrales({ [campo]: v });
        expect(r).toEqual({ ok: false, errores: [expect.stringContaining(campo)] });
      }
    }
  });

  it("rechaza tipos inválidos, NaN e infinitos", () => {
    for (const v of ["3", Number.NaN, Infinity, -Infinity, null, {}, [], true]) {
      expect(validarUmbrales({ alertaCercaPct: v }).ok).toBe(false);
    }
    for (const v of ["si", 1, 0, null]) expect(validarUmbrales({ alertaCercaActiva: v }).ok).toBe(false);
  });

  it("los días hábiles y los minutos deben ser enteros", () => {
    expect(validarUmbrales({ alertaExDiasHabiles: 2.5 }).ok).toBe(false);
    expect(validarUmbrales({ alertaDatoViejoMin: 30.5 }).ok).toBe(false);
  });

  it("rechaza una entrada que no es un objeto y las claves desconocidas", () => {
    for (const e of ["x", 3, [], true]) expect(validarUmbrales(e).ok).toBe(false);
    expect(validarUmbrales({ otraCosa: 1 }).ok).toBe(false);
  });

  it("acumula todos los errores y respeta lo demás por omisión", () => {
    const r = validarUmbrales({ alertaCercaPct: 99, alertaCaidaPct: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores).toHaveLength(2);
    const ok = validarUmbrales({ alertaCaidaActiva: false, alertaCercaPct: 5 });
    expect(ok).toEqual({ ok: true, umbrales: { ...UMBRALES_OMISION, alertaCaidaActiva: false, alertaCercaPct: 5 } });
  });

  it("devuelve un objeto nuevo: no muta la omisión", () => {
    const r = validarUmbrales({});
    if (r.ok) expect(r.umbrales).not.toBe(UMBRALES_OMISION);
  });

  it("solo cuentan las claves propias: lo heredado del prototipo no es un umbral ni se hereda", () => {
    expect(validarUmbrales({ constructor: 1 }).ok).toBe(false);
    expect(validarUmbrales(JSON.parse('{"__proto__": 1}')).ok).toBe(false);
    expect(validarUmbrales(Object.create({ alertaCercaPct: 99 }))).toEqual({ ok: true, umbrales: UMBRALES_OMISION });
  });
});
