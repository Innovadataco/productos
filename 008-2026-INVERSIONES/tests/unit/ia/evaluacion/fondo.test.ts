/**
 * El fondo del paquete DIARIO en el export (E7), puro: sale de lo que ya leyó y calculó la proyección (los lectores de
 * la pantalla de proyecciones): el valor de hoy del fondo (unidades × valor de unidad, de `calcularProyeccion`), su
 * último valor de unidad hasta hoy, el anterior y si está atrasado (DIAS_ATRASO_AVISO de src/fondo/guardar.ts). Un solo
 * fondo vivo; con varios, sin fondo y un aviso. Cifras inventadas.
 */
import { describe, expect, it } from "vitest";
import { DIAS_ATRASO_AVISO } from "@/fondo/guardar";
import type { EntradasProyeccion, ResultadoProyeccion } from "@/proyecciones/tipos";
import { fondoParaHechos } from "@/ia/evaluacion/exportar/fondo";

const dia = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const HOY = dia("2027-03-17");

function entradas(fondos: readonly { id: string; valores: readonly [string, number][] }[]): EntradasProyeccion {
  return {
    hoy: HOY, escisiones: [], cierresDestino: {}, noHabiles: [], incompletas: [],
    posiciones: fondos.map((f) => ({ tipo: "FONDO" as const, instrumentoId: f.id, nombre: `Fondo ficticio ${f.id}`, unidades: 137.4613, valores: f.valores.map(([d, v]) => ({ dia: dia(d), valorUnidad: v })) })),
  };
}

function resultado(valores: Readonly<Record<string, number | null>>): ResultadoProyeccion {
  const posiciones = Object.entries(valores).map(([id, valorHoy]) => ({ instrumentoId: id, nombre: id, tipo: "FONDO", estado: "PROYECTADA", valorHoy, peso: null, diasEnVentana: 0, diasTotales: 0, ultimoDia: null, dividendosUsados: 0, primerDividendo: null }));
  return { supuestos: { posiciones } } as unknown as ResultadoProyeccion;
}

describe("fondoParaHechos", () => {
  it("un fondo: el valor de la proyección, el último valor de unidad hasta hoy, el anterior y la fecha", () => {
    const r = fondoParaHechos(entradas([{ id: "f1", valores: [["2027-03-11", 13709.117], ["2027-03-15", 13711.2938], ["2027-03-19", 1.37]] }]), resultado({ f1: 1884761.4713 }), HOY);
    expect(r.aviso).toBeNull();
    expect(r.fondo?.valorUnidad.toFixed()).toBe("13711.2938");
    expect(r.fondo?.valorUnidadAnterior?.toFixed()).toBe("13709.117");
    expect(r.fondo?.fecha.toISOString().slice(0, 10)).toBe("2027-03-15");
    expect(r.fondo?.atrasado).toBe(false);
    expect(r.fondo?.valor?.toFixed()).toBe("1884761.47");
  });

  it(`atrasado si el último valor es de hace más de ${DIAS_ATRASO_AVISO} días; sin anterior si hay uno solo; sin valor si la proyección no lo valoró`, () => {
    const r = fondoParaHechos(entradas([{ id: "f1", valores: [["2027-03-02", 13691.37]] }]), resultado({ f1: null }), HOY);
    expect(r.fondo?.atrasado).toBe(true);
    expect(r.fondo?.valorUnidadAnterior).toBeNull();
    expect(r.fondo?.valor).toBeNull();
    expect(fondoParaHechos(entradas([{ id: "f1", valores: [["2027-03-10", 13691.37]] }]), resultado({}), HOY).fondo?.atrasado).toBe(false);
  });

  it("sin fondos vivos: sin fondo y sin aviso; un fondo sin valores hasta hoy: sin fondo, FONDO_SIN_VALOR", () => {
    expect(fondoParaHechos(entradas([]), resultado({}), HOY)).toEqual({ fondo: null, aviso: null });
    expect(fondoParaHechos(entradas([{ id: "f1", valores: [["2027-03-19", 1.37]] }]), resultado({ f1: 9 }), HOY)).toEqual({ fondo: null, aviso: "FONDO_SIN_VALOR" });
  });

  it("varios fondos vivos: sin fondo y FONDOS_VARIOS (el armador lleva uno; no se elige a ciegas)", () => {
    const dos = entradas([{ id: "f1", valores: [["2027-03-15", 1.5]] }, { id: "f2", valores: [["2027-03-15", 2.5]] }]);
    expect(fondoParaHechos(dos, resultado({ f1: 1, f2: 2 }), HOY)).toEqual({ fondo: null, aviso: "FONDOS_VARIOS" });
  });

  it("sin la proyección (no se pudo calcular), el fondo va sin valor", () => {
    const r = fondoParaHechos(entradas([{ id: "f1", valores: [["2027-03-15", 13711.2938]] }]), null, HOY);
    expect(r.fondo?.valor).toBeNull();
    expect(r.fondo?.valorUnidad.toFixed()).toBe("13711.2938");
  });
});
