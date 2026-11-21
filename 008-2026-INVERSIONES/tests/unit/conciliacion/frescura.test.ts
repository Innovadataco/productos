/**
 * Frescura de una conciliación guardada (PR-C, GATE 1 aprobada): la pantalla recalcula en solo lectura y compara
 * con lo guardado. Debe decir «igual» cuando solo cambia la forma (JSONB reordena las claves, Postgres devuelve
 * Decimal sin ceros finales, `createMany` no garantiza el orden) y «distinta» ante cualquier cambio de fondo.
 * Datos inventados.
 */
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calcularConciliacion, VERSION_CALCULO, type EntradasConciliacion } from "@/conciliacion/controles";
import { mismaConciliacion, type ControlGuardado, type ConciliacionGuardada } from "@/conciliacion/frescura";

const D = (v: string) => new Prisma.Decimal(v);

const entradas: EntradasConciliacion = {
  especies: [
    { instrumentoId: "A", certificada: { cantidad: 80n, precioValoracion: "10", valorMercado: "800" }, liquidada: 100n, operada: 80n, pendientes: 1, cierre: "10", escisionSinLote: false },
    { instrumentoId: "B", certificada: { cantidad: 20n, precioValoracion: "50", valorMercado: "1000" }, liquidada: 20n, operada: 20n, pendientes: 0, cierre: "51", escisionSinLote: false },
  ],
  fondos: [{ instrumentoId: "F", saldoCertificado: "5000", unidades: null, valorUnidad: null }],
  efectivo: { certificado: "300", liquidado: "250", operado: "250", hayFondo: true, aporteFondoRegistrado: false },
};
const recalculada = { versionCalculo: VERSION_CALCULO, ...calcularConciliacion(entradas) };

/** Lo que devuelve la base por la misma conciliación: Decimal, ceros finales quitados, JSONB con otro orden de claves. */
function comoEnLaBase(): ConciliacionGuardada {
  const controles: ControlGuardado[] = recalculada.controles.map((c) => ({
    tipo: c.tipo, instrumentoId: c.instrumentoId, resultado: c.resultado, codigoMotivo: c.codigoMotivo,
    esperado: c.esperado === null ? null : D(c.esperado), real: c.real === null ? null : D(c.real),
    diferencia: c.diferencia === null ? null : D(c.diferencia), tolerancia: c.tolerancia === null ? null : D(c.tolerancia),
    detalle: c.detalle === null ? null : Object.fromEntries(Object.entries(c.detalle).reverse()),
  }));
  return { versionCalculo: recalculada.versionCalculo, resultado: recalculada.resultado, controles: [...controles].reverse() };
}

describe("mismaConciliacion", () => {
  it("la prueba parte de una conciliación con T+2, motivos y detalle (si no, no probaría nada)", () => {
    expect(recalculada.resultado).toBe("NO_CUADRA");
    expect(recalculada.controles.some((c) => c.detalle !== null && Object.keys(c.detalle).length >= 2)).toBe(true);
    expect(recalculada.controles.some((c) => c.resultado === "PENDIENTE_LIQUIDACION")).toBe(true);
  });

  it("es la misma aunque cambien el orden de los controles, el de las claves del detalle y la escala de los decimales", () => {
    expect(mismaConciliacion(comoEnLaBase(), recalculada)).toBe(true);
  });

  it("es la misma con «1.500000» guardado contra «1.5» recalculado", () => {
    const guardada = comoEnLaBase();
    const conCeros = { ...guardada, controles: guardada.controles.map((c) => (c.esperado === null ? c : { ...c, esperado: D(c.esperado.toFixed(6)) })) };
    expect(mismaConciliacion(conCeros, recalculada)).toBe(true);
  });

  it("es la misma si el detalle guarda como texto lo que el cálculo da como número (o al revés)", () => {
    const guardada = comoEnLaBase();
    const controles = guardada.controles.map((c) =>
      c.detalle !== null && typeof c.detalle === "object" && !Array.isArray(c.detalle) && "pendientes" in c.detalle ? { ...c, detalle: { ...c.detalle, pendientes: String(c.detalle.pendientes) } } : c,
    );
    expect(controles).not.toEqual(guardada.controles);
    expect(mismaConciliacion({ ...guardada, controles }, recalculada)).toBe(true);
  });

  it("es distinta si cambia la versión del cálculo o el resultado global", () => {
    expect(mismaConciliacion({ ...comoEnLaBase(), versionCalculo: "conciliacion-v0" }, recalculada)).toBe(false);
    expect(mismaConciliacion({ ...comoEnLaBase(), resultado: "CUADRA" }, recalculada)).toBe(false);
  });

  it("es distinta si sobra o falta un control", () => {
    const guardada = comoEnLaBase();
    expect(mismaConciliacion({ ...guardada, controles: guardada.controles.slice(1) }, recalculada)).toBe(false);
    expect(mismaConciliacion({ ...guardada, controles: [...guardada.controles, guardada.controles[0]!] }, recalculada)).toBe(false);
  });

  it("es distinta si un control se repite en lugar de otro (mismo largo), en lo guardado o en lo recalculado", () => {
    const guardada = comoEnLaBase();
    const repetida = guardada.controles.map((c, k) => (k === 1 ? guardada.controles[0]! : c));
    expect(mismaConciliacion({ ...guardada, controles: repetida }, recalculada)).toBe(false);
    const recalculadaRepetida = { ...recalculada, controles: recalculada.controles.map((c, k) => (k === 1 ? recalculada.controles[0]! : c)) };
    expect(mismaConciliacion(guardada, recalculadaRepetida)).toBe(false);
  });

  it.each(["esperado", "real", "diferencia", "tolerancia"] as const)("es distinta si cambia «%s» de un control", (campo) => {
    const guardada = comoEnLaBase();
    const i = guardada.controles.findIndex((c) => c[campo] !== null);
    const controles = guardada.controles.map((c, k) => (k === i ? { ...c, [campo]: c[campo]!.add("0.000001") } : c));
    expect(mismaConciliacion({ ...guardada, controles }, recalculada)).toBe(false);
  });

  it("es distinta si cambia el resultado, el motivo o el detalle de un control", () => {
    const guardada = comoEnLaBase();
    const conMotivo = guardada.controles.findIndex((c) => c.codigoMotivo !== null);
    const conDetalle = guardada.controles.findIndex((c) => c.detalle !== null);
    const cambiar = (i: number, cambio: Partial<ControlGuardado>) => ({ ...guardada, controles: guardada.controles.map((c, k) => (k === i ? { ...c, ...cambio } : c)) });
    expect(mismaConciliacion(cambiar(conMotivo, { resultado: "CUADRA" }), recalculada)).toBe(false);
    expect(mismaConciliacion(cambiar(conMotivo, { codigoMotivo: "partida_sin_fuente_x" }), recalculada)).toBe(false);
    expect(mismaConciliacion(cambiar(conDetalle, { detalle: { otra: "1" } }), recalculada)).toBe(false);
    expect(mismaConciliacion(cambiar(conDetalle, { detalle: null }), recalculada)).toBe(false);
  });

  it("es distinta si el control cambia de especie, y distingue el total de acciones de una especie", () => {
    const guardada = comoEnLaBase();
    const i = guardada.controles.findIndex((c) => c.tipo === "CANTIDAD" && c.instrumentoId === "A");
    const otraEspecie = guardada.controles.map((c, k) => (k === i ? { ...c, instrumentoId: "Z" } : c));
    expect(mismaConciliacion({ ...guardada, controles: otraEspecie }, recalculada)).toBe(false);
    const total = guardada.controles.findIndex((c) => c.tipo === "VALOR" && c.instrumentoId === null);
    const sinAlcance = guardada.controles.map((c, k) => (k === total ? { ...c, detalle: null } : c));
    expect(mismaConciliacion({ ...guardada, controles: sinAlcance }, recalculada)).toBe(false);
  });

  it("un detalle guardado con una forma inesperada (arreglo, anidado) cuenta como distinto, sin lanzar", () => {
    const guardada = comoEnLaBase();
    const i = guardada.controles.findIndex((c) => c.detalle !== null);
    for (const raro of [["x"], { a: { b: 1 } }, "texto", 5] as Prisma.JsonValue[]) {
      const controles = guardada.controles.map((c, k) => (k === i ? { ...c, detalle: raro } : c));
      expect(mismaConciliacion({ ...guardada, controles }, recalculada)).toBe(false);
    }
  });
});
