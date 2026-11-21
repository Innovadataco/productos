// Validaciones puras del plan, las decisiones y los enlaces (fase B, corte 1). Datos inventados.
import { describe, expect, it } from "vitest";
import { esFechaDeNegocio, sumarDias } from "@/plan/fechas";
import {
  MAX_DIAS_VIGENCIA_FUTURA,
  MAX_TEXTO,
  validarDecision as validarDecisionEn,
  validarDecisionContraRegla,
  validarEnlace,
  validarMotivoEnlace,
  validarVersionPlan as validarVersionPlanEn,
  type DatosDecisionValidable,
  type DatosRegla,
  type DatosVersionValidable,
} from "@/plan/validar";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
// «Hoy» fijo: las fechas de los casos quedan en el pasado salvo donde se prueba el tope.
const HOY = dia("2025-12-31");
const validarVersionPlan = (d: DatosVersionValidable) => validarVersionPlanEn(d, HOY);
const validarDecision = (d: DatosDecisionValidable) => validarDecisionEn(d, HOY);

const regla = (cambios: Partial<DatosRegla> = {}): DatosRegla => ({
  instrumentoId: "inst-a",
  condicion: "CIERRE_BAJO",
  nivel: "1250.5",
  accion: "VENDER",
  cantidad: 10n,
  plazoHasta: dia("2025-06-30"),
  detalle: "Si cierra bajo el nivel, vender la mitad",
  ...cambios,
});

const version = (cambios: Partial<DatosVersionValidable> = {}): DatosVersionValidable => ({
  vigenteDesde: dia("2025-03-03"),
  motivo: "Plan ficticio de prueba",
  reglas: [regla()],
  ...cambios,
});

const decision = (cambios: Partial<DatosDecisionValidable> = {}): DatosDecisionValidable => ({
  fechaDecision: dia("2025-03-10"),
  instrumentoId: "inst-a",
  accion: "NO_ACTUAR",
  cantidad: 40n,
  reglaId: null,
  excepcion: false,
  motivo: "Mantener hasta el dividendo",
  ...cambios,
});

describe("fechas de negocio", () => {
  it("acepta medianoche UTC y rechaza horas, fechas inválidas y otros tipos", () => {
    expect(esFechaDeNegocio(dia("2025-03-03"))).toBe(true);
    expect(esFechaDeNegocio(new Date("2025-03-03T10:00:00Z"))).toBe(false);
    expect(esFechaDeNegocio(new Date("no es fecha"))).toBe(false);
    expect(esFechaDeNegocio("2025-03-03")).toBe(false);
  });

  it("suma días calendario sin depender de la zona horaria", () => {
    expect(sumarDias(dia("2025-01-31"), 30).toISOString()).toBe("2025-03-02T00:00:00.000Z");
    expect(sumarDias(dia("2025-03-02"), -7).toISOString()).toBe("2025-02-23T00:00:00.000Z");
  });
});

describe("versión del plan", () => {
  it("una versión completa y coherente no tiene errores", () => {
    expect(validarVersionPlan(version())).toEqual([]);
  });

  it("exige motivo, fecha válida y al menos una regla", () => {
    expect(validarVersionPlan(version({ motivo: "   " }))).toContainEqual({ campo: "motivo", codigo: "VACIO" });
    expect(validarVersionPlan(version({ motivo: "x".repeat(MAX_TEXTO + 1) }))).toContainEqual({ campo: "motivo", codigo: "DEMASIADO_LARGO" });
    expect(validarVersionPlan(version({ vigenteDesde: new Date("2025-03-03T05:00:00Z") }))).toContainEqual({ campo: "vigenteDesde", codigo: "FECHA_INVALIDA" });
    expect(validarVersionPlan(version({ reglas: [] }))).toContainEqual({ campo: "reglas", codigo: "SIN_REGLAS" });
  });

  it("el nivel va solo con condiciones que se calculan, y es positivo con hasta 6 decimales", () => {
    expect(validarVersionPlan(version({ reglas: [regla({ nivel: null })] }))).toContainEqual({ campo: "reglas[0].nivel", codigo: "NIVEL_FALTA" });
    expect(validarVersionPlan(version({ reglas: [regla({ condicion: "NINGUNA" })] }))).toContainEqual({ campo: "reglas[0].nivel", codigo: "NIVEL_SOBRA" });
    expect(validarVersionPlan(version({ reglas: [regla({ condicion: "LIBRE" })] }))).toContainEqual({ campo: "reglas[0].nivel", codigo: "NIVEL_SOBRA" });
    for (const nivel of ["0", "-5", "abc", "1.1234567", "1e5", ""]) {
      expect(validarVersionPlan(version({ reglas: [regla({ nivel })] })), nivel).toContainEqual({ campo: "reglas[0].nivel", codigo: "NIVEL_INVALIDO" });
    }
    expect(validarVersionPlan(version({ reglas: [regla({ condicion: "NINGUNA", nivel: null, accion: "NO_ACTUAR" })] }))).toEqual([]);
    expect(validarVersionPlan(version({ reglas: [regla({ condicion: "MONTO_ORDEN_BAJO", instrumentoId: null, nivel: "123.5", accion: "NO_ACTUAR" })] }))).toEqual([]);
  });

  it(`la vigencia no puede pasar de hoy + ${MAX_DIAS_VIGENCIA_FUTURA} días (una tabla que no se edita quedaría bloqueada)`, () => {
    const sinPlazo = [regla({ plazoHasta: null })];
    expect(validarVersionPlan(version({ vigenteDesde: sumarDias(HOY, MAX_DIAS_VIGENCIA_FUTURA), reglas: sinPlazo }))).toEqual([]);
    expect(validarVersionPlan(version({ vigenteDesde: sumarDias(HOY, MAX_DIAS_VIGENCIA_FUTURA + 1), reglas: sinPlazo }))).toEqual([{
      campo: "vigenteDesde",
      codigo: "VIGENCIA_DEMASIADO_LEJANA",
    }]);
  });

  it("valida cantidad, detalle, plazo, acción y condición de cada regla", () => {
    const errores = validarVersionPlan(
      version({
        reglas: [
          regla(),
          regla({ cantidad: 0n, detalle: " ", plazoHasta: dia("2025-03-02"), accion: "OTRA" as never, condicion: "RARA" as never, instrumentoId: "" }),
        ],
      }),
    );
    expect(errores).toEqual(
      expect.arrayContaining([
        { campo: "reglas[1].cantidad", codigo: "CANTIDAD_INVALIDA" },
        { campo: "reglas[1].detalle", codigo: "VACIO" },
        { campo: "reglas[1].plazoHasta", codigo: "PLAZO_ANTES_DE_LA_VIGENCIA" },
        { campo: "reglas[1].accion", codigo: "ACCION_INVALIDA" },
        { campo: "reglas[1].condicion", codigo: "CONDICION_INVALIDA" },
        { campo: "reglas[1].instrumentoId", codigo: "VACIO" },
      ]),
    );
    expect(errores.some((e) => e.campo.startsWith("reglas[0]"))).toBe(false);
  });
});

describe("decisión", () => {
  it("«no actuar» con cantidad es válida; sin cantidad no se puede medir", () => {
    expect(validarDecision(decision())).toEqual([]);
    expect(validarDecision(decision({ cantidad: null }))).toContainEqual({ campo: "cantidad", codigo: "CANTIDAD_FALTA" });
  });

  it("comprar o vender sin cantidad es válido: la mide la orden", () => {
    expect(validarDecision(decision({ accion: "VENDER", cantidad: null }))).toEqual([]);
    expect(validarDecision(decision({ accion: "COMPRAR", cantidad: -1n }))).toContainEqual({ campo: "cantidad", codigo: "CANTIDAD_INVALIDA" });
  });

  it("una decisión no puede tener fecha futura (máximo hoy)", () => {
    expect(validarDecision(decision({ fechaDecision: HOY }))).toEqual([]);
    expect(validarDecision(decision({ fechaDecision: sumarDias(HOY, 1) }))).toContainEqual({ campo: "fechaDecision", codigo: "FECHA_FUTURA" });
  });

  it("la excepción cita una regla; motivo, especie y fecha son obligatorios", () => {
    expect(validarDecision(decision({ excepcion: true }))).toContainEqual({ campo: "reglaId", codigo: "EXCEPCION_SIN_REGLA" });
    expect(validarDecision(decision({ excepcion: true, reglaId: "regla-1" }))).toEqual([]);
    expect(validarDecision(decision({ motivo: "" }))).toContainEqual({ campo: "motivo", codigo: "VACIO" });
    expect(validarDecision(decision({ instrumentoId: " " }))).toContainEqual({ campo: "instrumentoId", codigo: "VACIO" });
    expect(validarDecision(decision({ fechaDecision: new Date("x") }))).toContainEqual({ campo: "fechaDecision", codigo: "FECHA_INVALIDA" });
    expect(validarDecision(decision({ accion: "ESPERAR" as never }))).toContainEqual({ campo: "accion", codigo: "ACCION_INVALIDA" });
  });

  it("la regla citada es de la versión vigente y de la especie, o del portafolio", () => {
    const base = { planVersionId: "v2", instrumentoId: "inst-a", accion: "VENDER" as const };
    const d = { instrumentoId: "inst-a", accion: "VENDER" as const, excepcion: false };
    expect(validarDecisionContraRegla(d, base, "v2")).toEqual([]);
    expect(validarDecisionContraRegla(d, { ...base, instrumentoId: null }, "v2")).toEqual([]);
    expect(validarDecisionContraRegla(d, base, "v3")).toContainEqual({ campo: "reglaId", codigo: "REGLA_DE_OTRA_VERSION" });
    expect(validarDecisionContraRegla(d, { ...base, instrumentoId: "inst-b" }, "v2")).toContainEqual({ campo: "reglaId", codigo: "REGLA_DE_OTRA_ESPECIE" });
  });

  it("apartarse de la acción de la regla solo se registra como excepción", () => {
    const r = { planVersionId: "v1", instrumentoId: null, accion: "NO_ACTUAR" as const };
    expect(validarDecisionContraRegla({ instrumentoId: "inst-a", accion: "COMPRAR", excepcion: false }, r, "v1")).toContainEqual({
      campo: "accion",
      codigo: "ACCION_DISTINTA_SIN_EXCEPCION",
    });
    expect(validarDecisionContraRegla({ instrumentoId: "inst-a", accion: "COMPRAR", excepcion: true }, r, "v1")).toEqual([]);
  });
});

describe("enlace de una orden a su decisión", () => {
  const orden = { estado: "APROBADO" as const, instrumentoId: "inst-a", lado: "VENTA" as const, fechaOperacion: dia("2025-03-11") };
  const dec = { accion: "VENDER" as const, instrumentoId: "inst-a", fechaDecision: dia("2025-03-10"), reemplazada: false };

  it("una venta aprobada de la misma especie, después de decidir, se enlaza a «vender»", () => {
    expect(validarEnlace(orden, dec)).toEqual([]);
    expect(validarEnlace({ ...orden, fechaOperacion: dia("2025-03-10") }, dec)).toEqual([]);
    expect(validarEnlace({ ...orden, lado: "COMPRA" }, { ...dec, accion: "COMPRAR" })).toEqual([]);
  });

  it.each([
    ["ORDEN_NO_APROBADA", { ...orden, estado: "CANCELADO" as const }, dec],
    ["DECISION_REEMPLAZADA", orden, { ...dec, reemplazada: true }],
    ["NO_ACTUAR_SIN_ORDEN", orden, { ...dec, accion: "NO_ACTUAR" as const }],
    ["ESPECIE_DISTINTA", { ...orden, instrumentoId: "inst-b" }, dec],
    ["LADO_DISTINTO", { ...orden, lado: "COMPRA" as const }, dec],
    ["ORDEN_ANTERIOR_A_LA_DECISION", { ...orden, fechaOperacion: dia("2025-03-09") }, dec],
  ])("rechaza %s", (codigo, o, d) => {
    expect(validarEnlace(o, d).map((e) => e.codigo)).toContain(codigo);
  });

  it("el motivo es opcional, pero si viene no pasa del máximo", () => {
    expect(validarMotivoEnlace(undefined)).toEqual([]);
    expect(validarMotivoEnlace("  ")).toEqual([]);
    expect(validarMotivoEnlace("Era la otra decisión")).toEqual([]);
    expect(validarMotivoEnlace("x".repeat(MAX_TEXTO + 1))).toEqual([{ campo: "motivo", codigo: "DEMASIADO_LARGO" }]);
  });
});
