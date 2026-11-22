// Validación del simulador: los errores del usuario vuelven como datos (todos juntos); un estado, una regla, una
// orden o un «hoy» mal formados son un error de quien llama y lanzan RangeError. Datos inventados.
import { describe, expect, it } from "vitest";
import { revisarOperacion, validarContexto, validarEstado } from "@/operar/simulador/validar";
import type { EstadoSimulado, OperacionSimulada } from "@/operar/simulador/tipos";
import { A, B, C, CONTEXTO, D, ESTADO, HOY, dia, idDe, operacion, orden, posicion, regla } from "./apoyo/estado.ficticio";

const conEstado = (cambios: Partial<EstadoSimulado>): EstadoSimulado => ({ ...ESTADO, ...cambios });
const codigos = (op: OperacionSimulada) => {
  const r = revisarOperacion(op, ESTADO.posiciones);
  return r.ok ? [] : r.errores.map((e) => e.codigo);
};

describe("errores de la operación (datos para el usuario)", () => {
  it("una operación válida da la posición y el valor de la orden", () => {
    const r = revisarOperacion(operacion(A, "COMPRAR", 37n, "4613.271"), ESTADO.posiciones);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.posicion.nemotecnico).toBe(A);
    expect(r.valorOrden.eq(D("170691.027"))).toBe(true);
  });

  it("cantidad cero, negativa o que no es bigint: CANTIDAD_NO_POSITIVA", () => {
    expect(codigos(operacion(A, "COMPRAR", 0n, "11.71"))).toEqual(["CANTIDAD_NO_POSITIVA"]);
    expect(codigos(operacion(A, "COMPRAR", -1237n, "11.71"))).toEqual(["CANTIDAD_NO_POSITIVA"]);
    expect(codigos({ ...operacion(A, "COMPRAR", 1n, "11.71"), cantidad: 37 as unknown as bigint })).toEqual(["CANTIDAD_NO_POSITIVA"]);
  });

  it("precio cero, menos cero, negativo, NaN o que no es Decimal: PRECIO_NO_POSITIVO", () => {
    for (const p of ["0", "-0", "-11.71", "NaN"]) expect(codigos(operacion(A, "COMPRAR", 37n, p)), p).toEqual(["PRECIO_NO_POSITIVO"]);
    expect(codigos({ ...operacion(A, "COMPRAR", 37n, "1"), precioLimite: 11.71 as unknown as ReturnType<typeof D> })).toEqual(["PRECIO_NO_POSITIVO"]);
  });

  it("precio con más de 6 decimales, infinito o desde el tope: PRECIO_FUERA_DE_ESCALA", () => {
    for (const p of ["11.7100001", "Infinity", "10000000000000", "10000000000000.000001"]) expect(codigos(operacion(A, "COMPRAR", 1n, p)), p).toEqual(["PRECIO_FUERA_DE_ESCALA"]);
    expect(codigos(operacion(A, "COMPRAR", 1n, "9999999999999.999999"))).toEqual([]);
    expect(codigos(operacion(A, "COMPRAR", 1n, "0.000001"))).toEqual([]);
  });

  it("especie que no está en el estado: ESPECIE_DESCONOCIDA", () => {
    expect(codigos(operacion("FICTICIA-Z", "COMPRAR", 37n, "11.71"))).toEqual(["ESPECIE_DESCONOCIDA"]);
  });

  it("lado que no es COMPRAR ni VENDER (llega de un formulario): LADO_INVALIDO", () => {
    expect(codigos({ ...operacion(A, "COMPRAR", 37n, "11.71"), lado: "NO_ACTUAR" as unknown as "COMPRAR" })).toEqual(["LADO_INVALIDO"]);
  });

  it("vender más de lo que tiene: VENTA_SUPERA_TENENCIA con lo que tiene y lo que pide; vender todo sí se puede", () => {
    const r = revisarOperacion(operacion(B, "VENDER", 380n, "11.71"), ESTADO.posiciones);
    expect(r).toEqual({ ok: false, errores: [{ codigo: "VENTA_SUPERA_TENENCIA", tiene: 379n, pide: 380n }] });
    expect(codigos(operacion(B, "VENDER", 379n, "11.71"))).toEqual([]);
    expect(codigos(operacion(C, "VENDER", 1n, "823.19"))).toEqual(["VENTA_SUPERA_TENENCIA"]);
  });

  it("valor de la orden desde el tope: ORDEN_FUERA_DE_RANGO, sin pasar por number", () => {
    expect(codigos(operacion(A, "COMPRAR", 2n, "4999999999999.999999"))).toEqual([]);
    expect(codigos(operacion(A, "COMPRAR", 2n, "5000000000000"))).toEqual(["ORDEN_FUERA_DE_RANGO"]);
    expect(codigos(operacion(A, "COMPRAR", 2n ** 64n + 1n, "0.000001"))).toEqual(["ORDEN_FUERA_DE_RANGO"]);
  });

  it("junta todos los errores de una vez, en el orden del formulario, y no dice VENTA_SUPERA_TENENCIA si la especie no se conoce", () => {
    expect(codigos({ instrumentoId: "id-otra", lado: "VENDER", cantidad: 0n, precioLimite: D("0") })).toEqual(["ESPECIE_DESCONOCIDA", "CANTIDAD_NO_POSITIVA", "PRECIO_NO_POSITIVO"]);
    expect(codigos({ instrumentoId: "id-otra", lado: "VENDER", cantidad: 41n, precioLimite: D("11.71") })).toEqual(["ESPECIE_DESCONOCIDA"]);
    expect(codigos(operacion(B, "VENDER", 380n, "11.7100001"))).toEqual(["PRECIO_FUERA_DE_ESCALA", "VENTA_SUPERA_TENENCIA"]);
  });
});

describe("estado mal formado (error de quien llama)", () => {
  it("el estado de prueba es válido", () => {
    expect(() => validarEstado(ESTADO)).not.toThrow();
  });

  it("una especie repetida o sin id", () => {
    expect(() => validarEstado(conEstado({ posiciones: [posicion(A, 1n, "11.71"), posicion(A, 3n, "11.71")] }))).toThrow(RangeError);
    expect(() => validarEstado(conEstado({ posiciones: [{ ...posicion(A, 1n, "11.71"), instrumentoId: "" }] }))).toThrow(RangeError);
  });

  it("una cantidad negativa o que no es bigint", () => {
    expect(() => validarEstado(conEstado({ posiciones: [posicion(A, -1n, "11.71")] }))).toThrow(RangeError);
    expect(() => validarEstado(conEstado({ posiciones: [{ ...posicion(A, 1n, "11.71"), cantidad: 3 as unknown as bigint }] }))).toThrow(RangeError);
  });

  it("un cierre cero, negativo, no finito, con más de 6 decimales o desde el tope; null sí vale", () => {
    for (const c of ["0", "-4613.27", "NaN", "Infinity", "11.7100001", "10000000000000"]) {
      expect(() => validarEstado(conEstado({ posiciones: [posicion(A, 1n, c)] })), c).toThrow(RangeError);
    }
    expect(() => validarEstado(conEstado({ posiciones: [posicion(A, 1n, null)] }))).not.toThrow();
  });

  it("una caja no finita, con más de 6 decimales o desde el tope; negativa sí vale", () => {
    for (const c of ["NaN", "Infinity", "37911.4700001", "10000000000000", "-10000000000000"]) expect(() => validarEstado(conEstado({ caja: D(c) })), c).toThrow(RangeError);
    expect(() => validarEstado(conEstado({ caja: { toFixed: () => "1" } as unknown as ReturnType<typeof D> }))).toThrow(RangeError);
    expect(() => validarEstado(conEstado({ caja: D("-37911.47") }))).not.toThrow();
  });

  it("una regla incoherente: nivel donde no va, sin nivel donde va, nivel no positivo, cantidad no positiva o plazo inválido", () => {
    const malas = [
      regla({ condicion: "CIERRE_BAJO", nivel: null }),
      regla({ condicion: "MONTO_ORDEN_BAJO", nivel: null }),
      regla({ condicion: "NINGUNA", nivel: D("11.71") }),
      regla({ condicion: "LIBRE", nivel: D("11.71") }),
      regla({ condicion: "CIERRE_SOBRE", nivel: D("0") }),
      regla({ condicion: "CIERRE_SOBRE", nivel: D("NaN") }),
      regla({ cantidad: 0n }),
      regla({ accion: "MANTENER" as unknown as "NO_ACTUAR" }),
      regla({ condicion: "OTRA" as unknown as "NINGUNA" }),
      regla({ plazoHasta: new Date(Number.NaN) }),
      regla({ instrumentoId: "" }),
    ];
    for (const [i, r] of malas.entries()) expect(() => validarEstado(conEstado({ reglas: [r] })), `regla ${i}`).toThrow(RangeError);
    expect(() => validarEstado(conEstado({ reglas: [regla({ condicion: "CIERRE_BAJO", nivel: D("4613.27"), accion: "VENDER", cantidad: 37n, instrumentoId: idDe(A) })] }))).not.toThrow();
  });
});

describe("contexto mal formado (error de quien llama)", () => {
  it("el contexto de prueba es válido", () => {
    expect(() => validarContexto(CONTEXTO)).not.toThrow();
  });

  it("hoy inválido o que no es medianoche UTC", () => {
    expect(() => validarContexto({ ...CONTEXTO, hoy: new Date(Number.NaN) })).toThrow(RangeError);
    expect(() => validarContexto({ ...CONTEXTO, hoy: new Date(HOY.getTime() + 1) })).toThrow(RangeError);
    expect(() => validarContexto({ ...CONTEXTO, hoy: "2027-03-17" as unknown as Date })).toThrow(RangeError);
    expect(() => validarContexto({ ...CONTEXTO, hoy: dia("2027-11-23") })).not.toThrow();
  });

  it("una orden con montos negativos o no finitos, o con lado o estado desconocidos", () => {
    const malas = [
      orden("COMPRA", "-1237.6", "7.35"),
      orden("COMPRA", "1237.6", "-7.35"),
      orden("VENTA", "NaN", "7.35"),
      orden("VENTA", "1237.6", "Infinity"),
      { ...orden("COMPRA", "1237.6", "7.35"), lado: "COMPRAR" as unknown as "COMPRA" },
      { ...orden("COMPRA", "1237.6", "7.35"), estado: "PENDIENTE" as unknown as "APROBADO" },
    ];
    for (const [i, o] of malas.entries()) expect(() => validarContexto({ ...CONTEXTO, ordenes: [o] }), `orden ${i}`).toThrow(RangeError);
    expect(() => validarContexto({ ...CONTEXTO, ordenes: [orden("VENTA", "0", "0", "CANCELADO")] })).not.toThrow();
  });
});
