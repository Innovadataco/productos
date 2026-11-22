// Planificación de los rendimientos del fondo (frente fondo-rendimientos, T3: src/fondo/rendimientos/planificar.ts),
// pura: qué hacer con cada fila del CSV frente a lo ya registrado del fondo y a su constitución. Nada se corrige: una
// fila ya registrada con otro valor rechaza el archivo (VALOR_DISTINTO), y ninguna puede ser anterior a la constitución.
// Datos inventados (2027, cifras raras).
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { claveFila, type FilaRendimiento, type TipoRendimiento } from "@/fondo/rendimientos/csv";
import { contarRendimientos, hayNuevos, planificarRendimientos, type HechoGuardado } from "@/fondo/rendimientos/planificar";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const CONSTITUCION = dia("2027-01-14");

let linea = 1;
const fila = (fecha: string, tipo: TipoRendimiento, valor: string): FilaRendimiento => ({
  linea: (linea += 1), fecha: dia(fecha), tipo, valor, crudo: { fecha, tipo, valor },
});
const guardado = (fecha: string, tipo: TipoRendimiento, valor: string, filaFuenteId: string): HechoGuardado => ({
  fecha: dia(fecha), tipo, valor: new Prisma.Decimal(valor), filaFuenteId,
});
const mapa = (...hechos: HechoGuardado[]) => new Map(hechos.map((h) => [claveFila(h), h]));

describe("planificarRendimientos", () => {
  it("lo que no está registrado es NUEVO; lo registrado con el mismo valor (como decimal), SIN_CAMBIOS", () => {
    const filas = [fila("2027-02-17", "RENDIMIENTO", "48213.37"), fila("2027-02-17", "RETENCION", "1748.6233"), fila("2027-03-17", "RENDIMIENTO", "48211.9")];
    const r = planificarRendimientos(filas, mapa(guardado("2027-02-17", "RENDIMIENTO", "48213.3700", "f-1")), CONSTITUCION);
    expect(r.hallazgos).toEqual([]);
    expect(r.planes.map((p) => [p.fila.linea, p.plan])).toEqual([
      [filas[0]!.linea, { accion: "SIN_CAMBIOS", filaFuenteId: "f-1" }],
      [filas[1]!.linea, { accion: "NUEVO" }],
      [filas[2]!.linea, { accion: "NUEVO" }],
    ]);
    expect(contarRendimientos(r.planes)).toEqual({ filas: 3, rendimientos: 1, retenciones: 1, sinCambios: 1 });
    expect(hayNuevos(contarRendimientos(r.planes))).toBe(true);
  });

  it("la misma fecha y tipo ya registrada con otro valor: VALOR_DISTINTO en su línea (no se corrige ni se duplica)", () => {
    const f = fila("2027-02-17", "RETENCION", "1748.6234");
    const r = planificarRendimientos([f], mapa(guardado("2027-02-17", "RETENCION", "1748.6233", "f-2")), CONSTITUCION);
    expect(r.hallazgos).toEqual([{ linea: f.linea, columna: "valor", codigo: "VALOR_DISTINTO" }]);
    expect(r.planes).toEqual([]);
  });

  it("una fila anterior a la constitución del fondo se rechaza; la del mismo día, no", () => {
    const antes = fila("2027-01-13", "RENDIMIENTO", "48213.37");
    const mismo = fila("2027-01-14", "RENDIMIENTO", "48213.37");
    const r = planificarRendimientos([antes, mismo], mapa(), CONSTITUCION);
    expect(r.hallazgos).toEqual([{ linea: antes.linea, columna: "fecha", codigo: "FECHA_ANTES_DE_LA_CONSTITUCION" }]);
    expect(r.planes.map((p) => p.fila.linea)).toEqual([mismo.linea]);
  });

  it("todo registrado: sin nuevos", () => {
    const r = planificarRendimientos([fila("2027-02-17", "RETENCION", "1748.6233")], mapa(guardado("2027-02-17", "RETENCION", "1748.6233", "f-3")), CONSTITUCION);
    expect(contarRendimientos(r.planes)).toEqual({ filas: 1, rendimientos: 0, retenciones: 0, sinCambios: 1 });
    expect(hayNuevos(contarRendimientos(r.planes))).toBe(false);
  });
});
