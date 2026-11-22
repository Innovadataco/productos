// Puntos para revisar: cada clave del catálogo con un caso que la dispara y otro que no, el orden, las guardas y que
// nada del texto libre ni de la acción de una regla llegue a la salida. Puro.
import { describe, expect, it } from "vitest";
import { analizar } from "@/analisis/analizar";
import { CLAVES_OBSERVACION, CRITERIOS, type ClaveObservacion, type Observacion } from "@/analisis/catalogo";
import { diasEntre } from "@/analisis/dias";
import { observaciones } from "@/analisis/observaciones";
import { VERSION_ANALISIS, type Analisis, type ReglaParaAnalisis } from "@/analisis/tipos";
import { AL_DIA, analisis, analisisConTodo, concentracion, cubierta, especie, HOY, MAS, regla, riesgo, sinValor, vacio } from "./fixtures/analisis.ficticio";
import { D, dia, diasHabiles, portafolio, serieDeRetornos } from "./fixtures/portafolio.ficticio";

const obs = (a: Analisis, reglas: readonly ReglaParaAnalisis[] = []) => observaciones(a, { reglas }, dia(HOY));
const de = <C extends ClaveObservacion>(lista: readonly Observacion[], clave: C) => lista.filter((o): o is Extract<Observacion, { clave: C }> => o.clave === clave);

describe("sin nada que señalar", () => {
  it("un análisis tranquilo no da observaciones", () => {
    expect(obs(analisis({ especies: [especie("FICTICIA-A")] }))).toEqual([]);
  });
});

describe("concentración", () => {
  it("CONCENTRACION_ALTA: la primera pesa más de 0,25 (estricto)", () => {
    expect(de(obs(analisis({ concentracion: concentracion(0.25000001, 0.5, 4) })), "CONCENTRACION_ALTA")).toEqual([
      { clave: "CONCENTRACION_ALTA", umbral: 0.25, datos: { instrumentoId: "FICTICIA-A", peso: 0.25000001 } },
    ]);
    expect(de(obs(analisis({ concentracion: concentracion(0.25, 0.5, 4) })), "CONCENTRACION_ALTA")).toEqual([]);
  });

  it("CONCENTRACION_TOP_TRES: las tres primeras pesan más de 0,6, solo con cuatro o más especies", () => {
    expect(de(obs(analisis({ concentracion: concentracion(0.25, 0.60000001, 4) })), "CONCENTRACION_TOP_TRES")).toEqual([
      { clave: "CONCENTRACION_TOP_TRES", umbral: 0.6, datos: { instrumentoIds: ["FICTICIA-A", "FICTICIA-B", "FICTICIA-C"], peso: 0.60000001 } },
    ]);
    expect(de(obs(analisis({ concentracion: concentracion(0.25, 0.6, 4) })), "CONCENTRACION_TOP_TRES")).toEqual([]);
    expect(de(obs(analisis({ concentracion: concentracion(0.4, 1, 3) })), "CONCENTRACION_TOP_TRES")).toEqual([]);
  });
});

describe("riesgo", () => {
  it("CORRELACION_ALTA: un par con ρ ≥ 0,8; ni por debajo, ni la negativa, ni la que no se calculó", () => {
    const r = riesgo(["FICTICIA-A", "FICTICIA-B", "FICTICIA-C", "FICTICIA-D"], [
      [1, 0.8, 0.79999999, -0.95],
      [0.8, 1, null, 0.3],
      [0.79999999, null, null, 0.1],
      [-0.95, 0.3, 0.1, 1],
    ]);
    expect(de(obs(analisis({ riesgo: r })), "CORRELACION_ALTA")).toEqual([
      { clave: "CORRELACION_ALTA", umbral: 0.8, datos: { instrumentoIds: ["FICTICIA-A", "FICTICIA-B"], correlacion: 0.8 } },
    ]);
  });

  it("CONTRIBUCION_RIESGO_DESPROPORCIONADA: aporta 1,5 veces su peso o más, y al menos 0,1 del riesgo", () => {
    const especies = [
      especie("FICTICIA-A", { riesgo: cubierta(0.4, 0.6) }),
      especie("FICTICIA-B", { riesgo: cubierta(0.4, 0.59999999) }),
      especie("FICTICIA-C", { riesgo: cubierta(0.05, 0.09) }),
      especie("FICTICIA-D", { riesgo: cubierta(0.15, null) }),
    ];
    expect(de(obs(analisis({ especies })), "CONTRIBUCION_RIESGO_DESPROPORCIONADA")).toEqual([
      { clave: "CONTRIBUCION_RIESGO_DESPROPORCIONADA", umbral: 1.5, datos: { instrumentoId: "FICTICIA-A", pesoEnCubiertas: 0.4, contribucionPct: 0.6, veces: 1.5 } },
    ]);
  });

  it("HISTORIA_INSUFICIENTE: una por especie sin historia en la ventana común", () => {
    const especies = [especie("FICTICIA-A", { riesgo: { estado: "SIN_HISTORIA", motivo: "HISTORIA_CORTA", dias: 100 } }), especie("FICTICIA-B", { riesgo: cubierta(1, 1) })];
    expect(de(obs(analisis({ especies })), "HISTORIA_INSUFICIENTE")).toEqual([
      { clave: "HISTORIA_INSUFICIENTE", umbral: 250, datos: { instrumentoId: "FICTICIA-A", motivo: "HISTORIA_CORTA", dias: 100 } },
    ]);
  });
});

describe("reglas", () => {
  const conCierres = analisis({
    especies: [especie("FICTICIA-A"), especie("FICTICIA-B", { cierre: { estado: "SIN_NEGOCIACION", dia: "2021-06-04", precio: D("1237"), desde: "2021-06-07" } })],
    sinTenencia: [{ instrumentoId: "FICTICIA-Z", cierre: AL_DIA }],
  });

  it("REGLA_CUMPLIDA: el cierre al día pasó el nivel, bajo o sobre, también en una especie sin tenencia", () => {
    const reglas = [
      regla("FICTICIA-R1", { condicion: "CIERRE_BAJO", nivel: D("1300") }),
      regla("FICTICIA-R2", { condicion: "CIERRE_SOBRE", nivel: D("1200") }),
      regla("FICTICIA-R3", { instrumentoId: "FICTICIA-B", condicion: "CIERRE_BAJO", nivel: D("1300") }),
      regla("FICTICIA-R4", { instrumentoId: "FICTICIA-Z", condicion: "CIERRE_BAJO", nivel: D("1300") }),
      regla("FICTICIA-R5", { instrumentoId: null, condicion: "MONTO_ORDEN_BAJO", nivel: D("379") }),
      regla("FICTICIA-R6", { instrumentoId: "FICTICIA-Q", condicion: "CIERRE_BAJO", nivel: D("1300") }),
      regla("FICTICIA-R7", { condicion: "NINGUNA" }),
    ];
    expect(de(obs(conCierres, reglas), "REGLA_CUMPLIDA")).toEqual([
      { clave: "REGLA_CUMPLIDA", umbral: 0, datos: { reglaId: "FICTICIA-R1", instrumentoId: "FICTICIA-A", lado: "BAJO" } },
      { clave: "REGLA_CUMPLIDA", umbral: 0, datos: { reglaId: "FICTICIA-R2", instrumentoId: "FICTICIA-A", lado: "SOBRE" } },
      { clave: "REGLA_CUMPLIDA", umbral: 0, datos: { reglaId: "FICTICIA-R4", instrumentoId: "FICTICIA-Z", lado: "BAJO" } },
    ]);
  });

  it("REGLA_CERCANA: a 5 % o menos del nivel, o en el nivel; a 5,01 % no", () => {
    const reglas = [
      regla("FICTICIA-R1", { condicion: "CIERRE_SOBRE", nivel: D("1298.85") }),
      regla("FICTICIA-R2", { condicion: "CIERRE_SOBRE", nivel: D("1298.97") }),
      regla("FICTICIA-R3", { condicion: "CIERRE_BAJO", nivel: D("1237") }),
      regla("FICTICIA-R4", { condicion: "CIERRE_BAJO", nivel: D("1175.15") }),
    ];
    expect(de(obs(conCierres, reglas), "REGLA_CERCANA")).toEqual([
      { clave: "REGLA_CERCANA", umbral: 5, datos: { reglaId: "FICTICIA-R1", instrumentoId: "FICTICIA-A", distanciaPct: 5 } },
      { clave: "REGLA_CERCANA", umbral: 5, datos: { reglaId: "FICTICIA-R3", instrumentoId: "FICTICIA-A", distanciaPct: 0 } },
      { clave: "REGLA_CERCANA", umbral: 5, datos: { reglaId: "FICTICIA-R4", instrumentoId: "FICTICIA-A", distanciaPct: -5 } },
    ]);
  });

  it("REGLA_VENCE_PRONTO: el plazo cae de hoy a 14 días; REGLA_VENCIDA: ya pasó", () => {
    const reglas = [
      regla("FICTICIA-R1", { plazoHasta: dia(MAS(14)) }),
      regla("FICTICIA-R2", { plazoHasta: dia(MAS(15)) }),
      regla("FICTICIA-R3", { plazoHasta: dia(HOY) }),
      regla("FICTICIA-R4", { plazoHasta: dia(MAS(-1)) }),
    ];
    const lista = obs(conCierres, reglas);
    expect(de(lista, "REGLA_VENCE_PRONTO")).toEqual([
      { clave: "REGLA_VENCE_PRONTO", umbral: 14, datos: { reglaId: "FICTICIA-R1", instrumentoId: "FICTICIA-A", plazo: MAS(14), dias: 14 } },
      { clave: "REGLA_VENCE_PRONTO", umbral: 14, datos: { reglaId: "FICTICIA-R3", instrumentoId: "FICTICIA-A", plazo: HOY, dias: 0 } },
    ]);
    expect(de(lista, "REGLA_VENCIDA")).toEqual([{ clave: "REGLA_VENCIDA", umbral: 1, datos: { reglaId: "FICTICIA-R4", instrumentoId: "FICTICIA-A", plazo: MAS(-1), dias: 1 } }]);
    const portafolio = obs(conCierres, [regla("FICTICIA-R5", { instrumentoId: null, plazoHasta: dia(MAS(3)) })]);
    expect(de(portafolio, "REGLA_VENCE_PRONTO").map((o) => o.datos.instrumentoId)).toEqual([null]);
  });
});

describe("precios", () => {
  it("PRECIO_ATRASADO: sin negociación o sin cierre; ni al día ni sin calendario", () => {
    const especies = [
      especie("FICTICIA-A", { cierre: { estado: "SIN_NEGOCIACION", dia: "2021-06-04", precio: D("1237"), desde: "2021-06-07" } }),
      sinValor("FICTICIA-B"),
      especie("FICTICIA-C", { cierre: { estado: "SIN_CALENDARIO", dia: "2021-06-04", precio: D("1237"), anio: 2021 } }),
      especie("FICTICIA-D"),
    ];
    expect(de(obs(analisis({ especies })), "PRECIO_ATRASADO")).toEqual([
      { clave: "PRECIO_ATRASADO", umbral: 1, datos: { instrumentoId: "FICTICIA-A", ultimoCierre: { dia: "2021-06-04", sinNegociacionDesde: "2021-06-07" } } },
      { clave: "PRECIO_ATRASADO", umbral: 1, datos: { instrumentoId: "FICTICIA-B", ultimoCierre: null } },
    ]);
  });

  it("PRECIOS_SIN_ACTUALIZAR: la carga se detuvo; no si sigue o si no hay referencia", () => {
    expect(de(obs(analisis({ referencia: { dia: "2021-06-04", cargaDetenida: true } })), "PRECIOS_SIN_ACTUALIZAR")).toEqual([
      { clave: "PRECIOS_SIN_ACTUALIZAR", umbral: 1, datos: { referencia: "2021-06-04" } },
    ]);
    expect(de(obs(analisis()), "PRECIOS_SIN_ACTUALIZAR")).toEqual([]);
    expect(de(obs(analisis({ referencia: null })), "PRECIOS_SIN_ACTUALIZAR")).toEqual([]);
  });
});

describe("decisiones y dividendos", () => {
  it("DECISION_RESULTADO_NEGATIVO: NO_FUNCIONO conocido en los últimos 30 días", () => {
    const medida = (decisionId: string, conocidoEl: string, veredicto: "FUNCIONO" | "NO_FUNCIONO" = "NO_FUNCIONO") => ({ decisionId, horizonteDias: 30 as const, veredicto, resultadoPesos: D("-1237.41"), conocidoEl });
    const decisiones = { d30: vacio(30), d90: vacio(90), medidas: [medida("FICTICIA-DEC-A", MAS(-30)), medida("FICTICIA-DEC-B", MAS(-31)), medida("FICTICIA-DEC-C", MAS(-3), "FUNCIONO"), medida("FICTICIA-DEC-D", MAS(1))] };
    expect(de(obs(analisis({ decisiones })), "DECISION_RESULTADO_NEGATIVO")).toEqual([
      { clave: "DECISION_RESULTADO_NEGATIVO", umbral: 30, datos: { decisionId: "FICTICIA-DEC-A", horizonteDias: 30, resultadoPesos: D("-1237.41"), conocidoEl: MAS(-30), dias: 30 } },
    ]);
  });

  it("EX_DIVIDENDO_PRONTO: la fecha ex cae de hoy a 14 días", () => {
    const especies = [
      especie("FICTICIA-A", { proximaEx: { dia: MAS(14), decretoId: "FICTICIA-DEC-1" } }),
      especie("FICTICIA-B", { proximaEx: { dia: MAS(15), decretoId: "FICTICIA-DEC-2" } }),
    ];
    expect(de(obs(analisis({ especies })), "EX_DIVIDENDO_PRONTO")).toEqual([
      { clave: "EX_DIVIDENDO_PRONTO", umbral: 14, datos: { instrumentoId: "FICTICIA-A", decretoId: "FICTICIA-DEC-1", fechaEx: MAS(14), dias: 14 } },
    ]);
  });
});

describe("el catálogo entero", () => {
  it("hay un caso que dispara cada clave, y salen en el orden del catálogo", () => {
    const { a, reglas } = analisisConTodo();
    const lista = obs(a, reglas);
    expect([...new Set(lista.map((o) => o.clave))]).toEqual([...CLAVES_OBSERVACION]);
    expect(lista.every((o) => o.umbral === CRITERIOS[o.clave].umbral)).toBe(true);
  });

  it("dentro de una clave, por sus ids", () => {
    const especies = ["FICTICIA-C", "FICTICIA-A", "FICTICIA-B"].map((id) => sinValor(id));
    expect(de(obs(analisis({ especies })), "PRECIO_ATRASADO").map((o) => o.datos.instrumentoId)).toEqual(["FICTICIA-A", "FICTICIA-B", "FICTICIA-C"]);
  });

  it("los días de cada observación son los del calendario", () => {
    const { a, reglas } = analisisConTodo();
    const vence = de(obs(a, reglas), "REGLA_VENCE_PRONTO")[0]!;
    expect(vence.datos.dias).toBe(diasEntre(HOY, vence.datos.plazo));
  });
});

describe("guardas", () => {
  it("hoy debe ser el día del análisis, una fecha de negocio, y la versión la de este motor", () => {
    const a = analisis();
    expect(() => observaciones(a, { reglas: [] }, dia("2021-06-16"))).toThrow(RangeError);
    expect(() => observaciones(a, { reglas: [] }, new Date("2021-06-15T05:00:00Z"))).toThrow(RangeError);
    expect(() => observaciones({ ...a, version: "analisis-v0" as typeof VERSION_ANALISIS }, { reglas: [] }, dia(HOY))).toThrow(RangeError);
  });

  it("valida el plan (ids repetidos)", () => {
    expect(() => obs(analisis(), [regla("FICTICIA-R1"), regla("FICTICIA-R1")])).toThrow(RangeError);
  });

  it("ni el texto libre ni la acción ni la cantidad de una regla llegan a la salida", () => {
    const completa = { ...regla("FICTICIA-R1", { condicion: "CIERRE_BAJO", nivel: D("1300"), plazoHasta: dia(MAS(2)) }), accion: "VENDER", cantidad: 379n, detalle: "venda ya todo" };
    const texto = JSON.stringify(obs(analisis({ especies: [especie("FICTICIA-A")] }), [completa]), (_, v: unknown) => (typeof v === "bigint" ? v.toString() : v));
    expect(texto).toContain("FICTICIA-R1");
    expect(texto).not.toMatch(/venda|VENDER|379|detalle|accion|cantidad/);
  });
});

describe("sobre un análisis real", () => {
  it("una sola especie con poca historia: concentración alta e historia insuficiente", () => {
    const dias = diasHabiles("2019-01-02", 60);
    const e = portafolio([{ id: "FICTICIA-A", cantidad: 37, cierres: serieDeRetornos(dias, 1237.4, Array(59).fill(0.0003)) }]);
    const lista = observaciones(analizar(e), { reglas: [] }, e.hoy);
    expect(lista.map((o) => o.clave)).toEqual(["CONCENTRACION_ALTA", "HISTORIA_INSUFICIENTE"]);
  });
});
