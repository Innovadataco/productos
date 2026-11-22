// Validación del simulador: los errores del usuario vuelven como datos (todos juntos); un estado, una regla, una
// orden, una operación o un «hoy» mal formados son un error de quien llama y lanzan RangeError. Datos inventados.
import { describe, expect, it } from "vitest";
import { revisarOperacion, validarContexto, validarEstado } from "@/operar/simulador/validar";
import type { EstadoSimulado, OperacionSimulada } from "@/operar/simulador/tipos";
import { A, B, C, CONTEXTO, D, ESTADO, HOY, dia, idDe, operacion, orden, posicion, regla } from "./apoyo/estado.ficticio";

const conEstado = (cambios: Partial<EstadoSimulado>): EstadoSimulado => ({ ...ESTADO, ...cambios });
const codigos = (op: OperacionSimulada, posiciones = ESTADO.posiciones) => {
  const r = revisarOperacion(op, posiciones);
  return r.ok ? [] : r.errores.map((e) => e.codigo);
};
/** Un objeto que se hace pasar por Decimal ante `Decimal.isDecimal` (llega así de un JSON). */
const DECIMAL_FALSO = { toStringTag: "[object Decimal]" } as unknown as ReturnType<typeof D>;

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

  it("cantidad desde el tope (diez billones de acciones): CANTIDAD_FUERA_DE_RANGO, sin repetir la cifra gigante", () => {
    expect(codigos(operacion(A, "COMPRAR", 10n ** 13n, "0.000001"))).toEqual(["CANTIDAD_FUERA_DE_RANGO"]);
    expect(codigos(operacion(A, "COMPRAR", 10n ** 13n - 1n, "0.000001"))).toEqual([]);
    const r = revisarOperacion(operacion(B, "VENDER", 10n ** 100_000n, "1.37"), ESTADO.posiciones);
    expect(r).toEqual({ ok: false, errores: [{ codigo: "CANTIDAD_FUERA_DE_RANGO" }] });
  });

  it("precio cero, menos cero, negativo, NaN, que no es Decimal o un Decimal falso: PRECIO_NO_POSITIVO, sin lanzar", () => {
    for (const p of ["0", "-0", "-11.71", "NaN"]) expect(codigos(operacion(A, "COMPRAR", 37n, p)), p).toEqual(["PRECIO_NO_POSITIVO"]);
    expect(codigos({ ...operacion(A, "COMPRAR", 37n, "1"), precioLimite: 11.71 as unknown as ReturnType<typeof D> })).toEqual(["PRECIO_NO_POSITIVO"]);
    expect(codigos({ ...operacion(A, "COMPRAR", 37n, "1"), precioLimite: DECIMAL_FALSO })).toEqual(["PRECIO_NO_POSITIVO"]);
  });

  it("precio con más de 6 decimales, infinito o desde el tope: PRECIO_FUERA_DE_ESCALA", () => {
    for (const p of ["11.7100001", "Infinity", "10000000000000", "10000000000000.000001"]) expect(codigos(operacion(A, "COMPRAR", 1n, p)), p).toEqual(["PRECIO_FUERA_DE_ESCALA"]);
    expect(codigos(operacion(A, "COMPRAR", 1n, "0.000001"))).toEqual([]);
  });

  it("especie que no está en el estado: ESPECIE_DESCONOCIDA", () => {
    expect(codigos(operacion("FICTICIA-Z", "COMPRAR", 37n, "11.71"))).toEqual(["ESPECIE_DESCONOCIDA"]);
  });

  it("lado que no es COMPRAR ni VENDER (llega de un formulario): LADO_INVALIDO", () => {
    expect(codigos({ ...operacion(A, "COMPRAR", 37n, "11.71"), lado: "NO_ACTUAR" as unknown as "COMPRAR" })).toEqual(["LADO_INVALIDO"]);
    expect(codigos({ ...operacion(A, "COMPRAR", 37n, "11.71"), lado: "toString" as unknown as "COMPRAR" })).toEqual(["LADO_INVALIDO"]);
  });

  it("vender más de lo que tiene: VENTA_SUPERA_TENENCIA con lo que tiene y lo que pide; vender todo sí se puede", () => {
    const r = revisarOperacion(operacion(B, "VENDER", 380n, "11.71"), ESTADO.posiciones);
    expect(r).toEqual({ ok: false, errores: [{ codigo: "VENTA_SUPERA_TENENCIA", tiene: 379n, pide: 380n }] });
    expect(codigos(operacion(B, "VENDER", 379n, "11.71"))).toEqual([]);
    expect(codigos(operacion(C, "VENDER", 1n, "823.19"))).toEqual(["VENTA_SUPERA_TENENCIA"]);
  });

  it("valor de la orden desde el tope: ORDEN_FUERA_DE_RANGO", () => {
    expect(codigos(operacion(A, "COMPRAR", 2n, "4999999999999.999999"), [posicion(A, 0n, "0.37")])).toEqual([]);
    expect(codigos(operacion(A, "COMPRAR", 2n, "5000000000000"), [posicion(A, 0n, "0.37")])).toEqual(["ORDEN_FUERA_DE_RANGO"]);
  });

  it("valor de la posición que deja la compra desde el tope (al cierre): ORDEN_FUERA_DE_RANGO, aunque la orden quepa", () => {
    const cara = [posicion(A, 1237n, "4613.27")];
    expect(codigos(operacion(A, "COMPRAR", 2_167_659_000n, "0.37"), cara)).toEqual(["ORDEN_FUERA_DE_RANGO"]);
    expect(codigos(operacion(A, "COMPRAR", 2_167_657_000n, "0.37"), cara)).toEqual([]);
  });

  it("junta todos los errores de una vez, en el orden del formulario, y no dice VENTA_SUPERA_TENENCIA si la especie no se conoce", () => {
    expect(codigos({ instrumentoId: "id-otra", lado: "VENDER", cantidad: 0n, precioLimite: D("0") })).toEqual(["ESPECIE_DESCONOCIDA", "CANTIDAD_NO_POSITIVA", "PRECIO_NO_POSITIVO"]);
    expect(codigos({ instrumentoId: "id-otra", lado: "VENDER", cantidad: 41n, precioLimite: D("11.71") })).toEqual(["ESPECIE_DESCONOCIDA"]);
    expect(codigos(operacion(B, "VENDER", 380n, "11.7100001"))).toEqual(["PRECIO_FUERA_DE_ESCALA", "VENTA_SUPERA_TENENCIA"]);
  });

  it("una operación que no es un objeto es un error de quien llama (RangeError, no TypeError)", () => {
    expect(() => revisarOperacion(null as unknown as OperacionSimulada, ESTADO.posiciones)).toThrow(RangeError);
    expect(() => revisarOperacion("COMPRAR" as unknown as OperacionSimulada, ESTADO.posiciones)).toThrow(RangeError);
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

  it("una cantidad negativa, que no es bigint o desde el tope", () => {
    expect(() => validarEstado(conEstado({ posiciones: [posicion(A, -1n, "11.71")] }))).toThrow(RangeError);
    expect(() => validarEstado(conEstado({ posiciones: [{ ...posicion(A, 1n, "11.71"), cantidad: 3 as unknown as bigint }] }))).toThrow(RangeError);
    expect(() => validarEstado(conEstado({ posiciones: [posicion(A, 10n ** 13n, null)] }))).toThrow(RangeError);
  });

  it("un cierre cero, negativo, no finito, falso, con más de 6 decimales o desde el tope; null sí vale", () => {
    for (const c of ["0", "-4613.27", "NaN", "Infinity", "11.7100001", "10000000000000"]) {
      expect(() => validarEstado(conEstado({ posiciones: [posicion(A, 1n, c)] })), c).toThrow(RangeError);
    }
    expect(() => validarEstado(conEstado({ posiciones: [{ ...posicion(A, 1n, null), cierre: { precio: DECIMAL_FALSO } }] }))).toThrow(RangeError);
    expect(() => validarEstado(conEstado({ posiciones: [{ ...posicion(A, 1n, null), cierre: D("11.71") as unknown as { precio: ReturnType<typeof D> } }] }))).toThrow(RangeError);
    expect(() => validarEstado(conEstado({ posiciones: [posicion(A, 1n, null)] }))).not.toThrow();
  });

  it("una posición que vale desde el tope (cantidad × cierre) no se calcula exacta: RangeError", () => {
    expect(() => validarEstado(conEstado({ posiciones: [posicion(A, 99_999n, "9999999999999.999999")] }))).toThrow(RangeError);
    expect(() => validarEstado(conEstado({ posiciones: [posicion(A, 2n, "4999999999999.999999")] }))).not.toThrow();
  });

  it("una caja no finita, falsa, con más de 6 decimales o desde el tope; negativa sí vale", () => {
    for (const c of ["NaN", "Infinity", "37911.4700001", "10000000000000", "-10000000000000"]) expect(() => validarEstado(conEstado({ caja: D(c) })), c).toThrow(RangeError);
    expect(() => validarEstado(conEstado({ caja: { toFixed: () => "1" } as unknown as ReturnType<typeof D> }))).toThrow(RangeError);
    expect(() => validarEstado(conEstado({ caja: DECIMAL_FALSO }))).toThrow(RangeError);
    expect(() => validarEstado(conEstado({ caja: D("-37911.47") }))).not.toThrow();
  });

  it("una regla incoherente: nivel donde no va, sin nivel donde va, nivel no positivo, cantidad no positiva, plazo, id o detalle inválidos", () => {
    const malas = [
      regla({ condicion: "CIERRE_BAJO", nivel: null }),
      regla({ condicion: "MONTO_ORDEN_BAJO", nivel: null }),
      regla({ condicion: "NINGUNA", nivel: D("11.71") }),
      regla({ condicion: "LIBRE", nivel: D("11.71") }),
      regla({ condicion: "CIERRE_SOBRE", nivel: D("0") }),
      regla({ condicion: "CIERRE_SOBRE", nivel: D("NaN") }),
      regla({ cantidad: 0n }),
      regla({ accion: "PAUSAR" as unknown as "NO_ACTUAR" }),
      regla({ condicion: "OTRA" as unknown as "NINGUNA" }),
      regla({ plazoHasta: new Date(Number.NaN) }),
      regla({ plazoHasta: new Date(HOY.getTime() + 1) }),
      regla({ instrumentoId: "" }),
      regla({ id: "" }),
      regla({ id: 4613 as unknown as string }),
      regla({ detalle: {} as unknown as string }),
      regla({ detalle: "x".repeat(2001) }),
    ];
    for (const [i, r] of malas.entries()) expect(() => validarEstado(conEstado({ reglas: [r] })), `regla ${i}`).toThrow(RangeError);
    expect(() => validarEstado(conEstado({ reglas: [regla({ condicion: "CIERRE_BAJO", nivel: D("4613.27"), accion: "VENDER", cantidad: 37n, instrumentoId: idDe(A) })] }))).not.toThrow();
    expect(() => validarEstado(conEstado({ reglas: [regla({ detalle: "x".repeat(2000) })] }))).not.toThrow();
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

  it("una orden con montos negativos, no finitos o falsos, o con lado o estado desconocidos", () => {
    const malas = [
      orden("COMPRA", "-1237.6", "7.35"),
      orden("COMPRA", "1237.6", "-7.35"),
      orden("VENTA", "NaN", "7.35"),
      orden("VENTA", "1237.6", "Infinity"),
      { ...orden("VENTA", "1237.6", "7.35"), comision: DECIMAL_FALSO },
      { ...orden("COMPRA", "1237.6", "7.35"), lado: "COMPRAR" as unknown as "COMPRA" },
      { ...orden("COMPRA", "1237.6", "7.35"), estado: "PENDIENTE" as unknown as "APROBADO" },
    ];
    for (const [i, o] of malas.entries()) expect(() => validarContexto({ ...CONTEXTO, ordenes: [o] }), `orden ${i}`).toThrow(RangeError);
    expect(() => validarContexto({ ...CONTEXTO, ordenes: [orden("VENTA", "0", "0", "CANCELADO")] })).not.toThrow();
  });
});
