import { describe, it, expect } from "vitest";
import {
  extraerIdDespachoExterno,
  extraerIdLlegadaExterno,
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

describe("normalizar: extraerIdLlegadaExterno", () => {
  it.each([
    [{ obj: { obj: { id: 11 } } }, 11],
    [{ obj: { idLlegada: 22 } }, 22],
    [{ data: { idLlegada: 33 } }, 33],
    [{ idLlegada: 44 }, 44],
    [{ id: 55 }, 55],
    [{ nada: 1 }, null],
  ])("extrae id de llegada de %o => %s", (res, esperado) => {
    expect(extraerIdLlegadaExterno(res)).toBe(esperado);
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

describe("normalizar: id de mantenimiento externo (spec 005)", () => {
  it("prueba candidatos id | mantenimientoId | mantenimiento_id | data.* | obj.*", async () => {
    const { extraerIdMantenimientoExterno } = await import("./normalizar");
    expect(extraerIdMantenimientoExterno({ id: 9001 })).toBe(9001);
    expect(extraerIdMantenimientoExterno({ mantenimientoId: 7 })).toBe(7);
    expect(extraerIdMantenimientoExterno({ mantenimiento_id: "8" })).toBe(8);
    expect(extraerIdMantenimientoExterno({ data: { mantenimientoId: 9 } })).toBe(9);
    expect(extraerIdMantenimientoExterno({ obj: { id: 10 } })).toBe(10);
    expect(extraerIdMantenimientoExterno({ mensaje: "sin id" })).toBeNull();
    expect(extraerIdMantenimientoExterno(null)).toBeNull();
  });
});
