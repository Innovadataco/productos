import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { evaluarNivel, type EntradaNivel } from "@/alertas/evaluar/nivel";
import { UMBRALES_OMISION } from "@/alertas/umbrales";

const D = (v: string) => new Prisma.Decimal(v);
const base = (o: Partial<EntradaNivel> = {}): EntradaNivel => ({
  reglaId: "regla-1", instrumentoId: "FICTICIA-A", condicion: "CIERRE_BAJO", nivel: D("100"),
  precio: { base: "CIERRE", precio: D("150") }, ...o,
});

describe("evaluarNivel", () => {
  it("CIERRE_BAJO con el precio por debajo: NIVEL_CRUZADO BAJO", () => {
    expect(evaluarNivel(base({ precio: { base: "CIERRE", precio: D("99.99") } }), UMBRALES_OMISION)).toMatchObject({ tipo: "NIVEL_CRUZADO", sentido: "BAJO", base: "CIERRE", reglaId: "regla-1" });
  });
  it("CIERRE_SOBRE con el precio por encima: NIVEL_CRUZADO SOBRE, con el precio intradía", () => {
    const a = evaluarNivel(base({ condicion: "CIERRE_SOBRE", precio: { base: "INTRADIA", precio: D("100.01") } }), UMBRALES_OMISION);
    expect(a).toMatchObject({ tipo: "NIVEL_CRUZADO", sentido: "SOBRE", base: "INTRADIA" });
  });
  it("frontera de cerca: 2,99 es cerca y 3,00 no", () => {
    // nivel 100 sobre un precio p: distancia = (100 − p)/p·100
    const cerca = evaluarNivel(base({ condicion: "CIERRE_SOBRE", precio: { base: "CIERRE", precio: D("97.10") } }), UMBRALES_OMISION); // 2,99 %
    const no = evaluarNivel(base({ condicion: "CIERRE_SOBRE", precio: { base: "CIERRE", precio: D("97.09") } }), UMBRALES_OMISION); // 2,9972 %, que se muestra 3,00
    expect(cerca).toMatchObject({ tipo: "NIVEL_CERCA", sentido: "SOBRE" });
    expect(no).toBeNull();
  });
  it("el lado contrario del nivel también cuenta como cerca, por la distancia absoluta", () => {
    // CIERRE_BAJO, precio por encima del nivel: 102 → (100−102)/102 = −1,96 %
    expect(evaluarNivel(base({ precio: { base: "CIERRE", precio: D("102") } }), UMBRALES_OMISION)).toMatchObject({ tipo: "NIVEL_CERCA", sentido: "BAJO" });
  });
  it("EN_EL_NIVEL cuenta como cerca", () => {
    expect(evaluarNivel(base({ precio: { base: "CIERRE", precio: D("100") } }), UMBRALES_OMISION)).toMatchObject({ tipo: "NIVEL_CERCA", sentido: "BAJO" });
  });
  it("lejos del nivel no salta", () => {
    expect(evaluarNivel(base(), UMBRALES_OMISION)).toBeNull();
  });
  it("sin precio, sin nivel o sin condición de nivel no salta", () => {
    expect(evaluarNivel(base({ precio: null }), UMBRALES_OMISION)).toBeNull();
    expect(evaluarNivel(base({ nivel: null }), UMBRALES_OMISION)).toBeNull();
    for (const condicion of ["NINGUNA", "LIBRE", "MONTO_ORDEN_BAJO"] as const) expect(evaluarNivel(base({ condicion }), UMBRALES_OMISION)).toBeNull();
    expect(evaluarNivel(base({ precio: { base: "CIERRE", precio: D("0") } }), UMBRALES_OMISION)).toBeNull();
  });
  it("respeta el umbral configurado de cerca", () => {
    const p = { base: "CIERRE", precio: D("102") } as const;
    expect(evaluarNivel(base({ precio: p }), { ...UMBRALES_OMISION, alertaCercaPct: 1 })).toBeNull();
    expect(evaluarNivel(base({ precio: p }), { ...UMBRALES_OMISION, alertaCercaPct: 2 })).toMatchObject({ tipo: "NIVEL_CERCA" });
  });
  it("los interruptores apagan cada tipo por separado", () => {
    const cruzado = base({ precio: { base: "CIERRE", precio: D("90") } });
    expect(evaluarNivel(cruzado, { ...UMBRALES_OMISION, alertaNivelCruzadoActiva: false })).toBeNull();
    expect(evaluarNivel(cruzado, { ...UMBRALES_OMISION, alertaCercaActiva: false })).toMatchObject({ tipo: "NIVEL_CRUZADO" });
    const cerca = base({ precio: { base: "CIERRE", precio: D("101") } });
    expect(evaluarNivel(cerca, { ...UMBRALES_OMISION, alertaCercaActiva: false })).toBeNull();
  });
  it("lleva los datos que el texto necesita", () => {
    const a = evaluarNivel(base({ precio: { base: "INTRADIA", precio: D("90"), instante: new Date("2027-03-01T15:35:00Z"), conRetraso: true } }), UMBRALES_OMISION);
    expect(a).toMatchObject({ instrumentoId: "FICTICIA-A", datos: { nivel: D("100"), precio: D("90"), instante: new Date("2027-03-01T15:35:00Z"), conRetraso: true } });
  });
});
