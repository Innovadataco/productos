import { describe, it, expect } from "vitest";
import {
  extraerIdDespachoExterno,
  extraerLista,
  extraerObjeto,
  extraerMensajeError,
  limpiarPlaca,
} from "@/lib/normalizar";

describe("normalizar: extraerIdDespachoExterno", () => {
  it.each([
    [{ obj: { obj: { id: 10 } } }, 10],
    [{ obj: { id: 20 } }, 20],
    [{ data: { id: 30 } }, 30],
    [{ id: 40 }, 40],
    [{ obj: { id: 0 } }, null],
    [{ nada: 1 }, null],
  ])("extrae id de %o => %s", (res, esperado) => {
    expect(extraerIdDespachoExterno(res)).toBe(esperado);
  });
});

describe("normalizar: listas y objetos tolerantes", () => {
  it("extraerLista acepta array_data | data | obj | raíz", () => {
    expect(extraerLista({ array_data: [1, 2] })).toEqual([1, 2]);
    expect(extraerLista({ data: [3] })).toEqual([3]);
    expect(extraerLista([9])).toEqual([9]);
    expect(extraerLista({ nada: 1 })).toEqual([]);
  });

  it("extraerObjeto desanida obj.obj | obj | data", () => {
    expect(extraerObjeto({ obj: { obj: { a: 1 } } })).toEqual({ a: 1 });
    expect(extraerObjeto({ obj: { a: 2 } })).toEqual({ a: 2 });
    expect(extraerObjeto({ data: { a: 3 } })).toEqual({ a: 3 });
  });
});

describe("normalizar: errores y placa", () => {
  it("extraerMensajeError prioriza responseData.mensaje", () => {
    expect(extraerMensajeError({ responseData: { mensaje: "boom" } })).toBe("boom");
    expect(extraerMensajeError(new Error("otro"))).toBe("otro");
  });

  it("limpiarPlaca quita espacios/guiones y pone mayúsculas", () => {
    expect(limpiarPlaca(" abc-123 ")).toBe("ABC123");
  });
});
