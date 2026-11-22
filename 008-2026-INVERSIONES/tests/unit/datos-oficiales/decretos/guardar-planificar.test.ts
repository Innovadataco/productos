// La parte pura del camino único de dividendo_decretado (fase C, C4a: src/datos-oficiales/decretos/guardar.ts).
// La base no impone la cadena de versiones (condición de C1): `planificar` debe morder una v2 sin v1, un número de
// versión que no sigue al anterior, un retiro sin sucesor, dos vigentes y una vigente que no es la última
// (CADENA_ROTA), y anular sin decreto (ANULACION_SIN_DECRETO). También la clave natural de la fila cruda y los conteos
// (la guarda del cruce por nombre de base se retiró en C5b). Datos inventados.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  claveDecreto, claveNaturalDecreto, contar, hayCambios, mismoContenido, planificar, planificarTodos,
  type DecretoResuelto, type VersionGuardada,
} from "@/datos-oficiales/decretos/guardar";
import type { DecretoLeido } from "@/datos-oficiales/decretos/filas";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const DECRETO: DecretoLeido = {
  linea: 2, especie: "FICTA", tipo: "ORDINARIO", fechaAnuncio: dia("2021-03-17"), cuota: 1, valorPorAccion: "1873.204517",
  fechaEx: dia("2021-04-14"), fechaPago: dia("2021-04-21"), referencia: "sfc:FICT-4613", anulada: false, nota: null,
};
const guardada = (version: number, vigente: boolean, cambios: Partial<VersionGuardada> = {}): VersionGuardada => ({
  id: `dec-${version}`, instrumentoId: "ins-a", tipo: "ORDINARIO", fechaAnuncio: DECRETO.fechaAnuncio, cuota: 1, version, vigente,
  valorPorAccion: new Prisma.Decimal("1873.204517"), fechaEx: DECRETO.fechaEx, fechaPago: DECRETO.fechaPago, referenciaOficial: DECRETO.referencia,
  nota: null, anulada: false, filaFuenteId: `fila-${version}`, ...cambios,
});
const con = (c: Partial<DecretoLeido>): DecretoLeido => ({ ...DECRETO, ...c });

describe("decretos · planificar", () => {
  it("sin versiones: la v1; anular sin decreto no se puede", () => {
    expect(planificar([], DECRETO)).toEqual({ accion: "NUEVO", version: 1 });
    expect(planificar([], con({ anulada: true, nota: "x" }))).toEqual({ accion: "RECHAZO", codigo: "ANULACION_SIN_DECRETO" });
  });

  it("igual a la vigente (el valor como decimal: 1873.2045170 = 1873.204517): sin cambios, con la fila cruda de la vigente", () => {
    const v = [guardada(1, false, { valorPorAccion: new Prisma.Decimal("1.3719") }), guardada(2, true, { valorPorAccion: new Prisma.Decimal("1873.2045170") })];
    expect(planificar(v, DECRETO)).toEqual({ accion: "SIN_CAMBIOS", filaFuenteId: "fila-2" });
  });

  it("cualquier campo distinto de la vigente: la versión siguiente, que retira a la vigente", () => {
    const v = [guardada(1, false), guardada(2, false), guardada(3, true)];
    const cambios: Partial<DecretoLeido>[] = [
      { valorPorAccion: "1873.204518" }, { fechaEx: dia("2021-04-13") }, { fechaPago: dia("2021-04-22") }, { referencia: "sfc:FICT-4614" },
      { nota: "corregida" }, { anulada: true, nota: "registrado con la cuota equivocada" },
    ];
    for (const c of cambios) expect(planificar(v, con(c)), JSON.stringify(c)).toEqual({ accion: "NUEVA_VERSION", version: 4, retirarId: "dec-3" });
  });

  it("una anulación igual a la vigente anulada no escribe; volver a registrarla (anulada NO) es la versión siguiente", () => {
    const anulada = [guardada(1, false), guardada(2, true, { anulada: true, nota: "x" })];
    expect(planificar(anulada, con({ anulada: true, nota: "x" }))).toEqual({ accion: "SIN_CAMBIOS", filaFuenteId: "fila-2" });
    expect(planificar(anulada, DECRETO)).toEqual({ accion: "NUEVA_VERSION", version: 3, retirarId: "dec-2" });
  });

  it("CADENA_ROTA: v2 sin v1, un número que no sigue, repetido, retiro sin sucesor, dos vigentes o la vigente no es la última", () => {
    const rotas: Record<string, VersionGuardada[]> = {
      "v2 sin v1": [guardada(2, true)],
      "1 y 3": [guardada(1, false), guardada(3, true)],
      "1 repetida": [guardada(1, false), guardada(1, true)],
      "retiro sin sucesor": [guardada(1, false)],
      "todas retiradas": [guardada(1, false), guardada(2, false)],
      "dos vigentes": [guardada(1, true), guardada(2, true)],
      "vigente no es la última": [guardada(1, true), guardada(2, false)],
    };
    for (const [caso, versiones] of Object.entries(rotas)) {
      expect(planificar(versiones, DECRETO), caso).toEqual({ accion: "RECHAZO", codigo: "CADENA_ROTA" });
      expect(planificar([...versiones].reverse(), DECRETO), `${caso} (en otro orden)`).toEqual({ accion: "RECHAZO", codigo: "CADENA_ROTA" });
    }
  });

  it("mismoContenido compara valor, fechas, referencia, nota y anulada", () => {
    expect(mismoContenido(guardada(1, true), DECRETO)).toBe(true);
    expect(mismoContenido(guardada(1, true, { nota: "x" }), DECRETO)).toBe(false);
  });
});

describe("decretos · planificar el archivo y contar", () => {
  const resuelto = (instrumentoId: string, d: Partial<DecretoLeido>): DecretoResuelto => ({ instrumentoId, fila: { decreto: con(d), crudo: {} } });

  it("cada fila contra las versiones de SU clave (instrumento, tipo, anuncio, cuota); los rechazos salen con su línea", () => {
    const versiones = new Map([
      [claveDecreto("ins-a", "ORDINARIO", DECRETO.fechaAnuncio, 1), [guardada(1, true)]],
      [claveDecreto("ins-a", "ORDINARIO", DECRETO.fechaAnuncio, 2), [guardada(1, true, { cuota: 2 })]],
      [claveDecreto("ins-b", "ORDINARIO", DECRETO.fechaAnuncio, 1), [guardada(2, true)]],
    ]);
    const filas = [
      resuelto("ins-a", { linea: 2 }), // igual a la vigente
      resuelto("ins-a", { linea: 3, cuota: 2, nota: "otra" }), // cambio
      resuelto("ins-a", { linea: 4, cuota: 3 }), // nuevo
      resuelto("ins-a", { linea: 5, tipo: "EXTRAORDINARIO", anulada: true, nota: "x" }), // anula sin decreto
      resuelto("ins-b", { linea: 6 }), // cadena rota
    ];
    const r = planificarTodos(filas, versiones);
    expect(r.planes.map((p) => [p.resuelto.fila.decreto.linea, p.plan.accion])).toEqual([[2, "SIN_CAMBIOS"], [3, "NUEVA_VERSION"], [4, "NUEVO"]]);
    expect(r.hallazgos).toEqual([
      { linea: 5, columna: null, codigo: "ANULACION_SIN_DECRETO" },
      { linea: 6, columna: null, codigo: "CADENA_ROTA" },
    ]);
  });

  it("los conteos separan nuevas, versiones, anulaciones y sin cambios", () => {
    const versiones = new Map([
      [claveDecreto("ins-a", "ORDINARIO", DECRETO.fechaAnuncio, 1), [guardada(1, true)]],
      [claveDecreto("ins-a", "ORDINARIO", DECRETO.fechaAnuncio, 2), [guardada(1, true, { cuota: 2 })]],
      [claveDecreto("ins-a", "ORDINARIO", DECRETO.fechaAnuncio, 3), [guardada(1, true, { cuota: 3 })]],
    ]);
    const { planes } = planificarTodos([
      resuelto("ins-a", { linea: 2 }), resuelto("ins-a", { linea: 3, cuota: 2, valorPorAccion: "4.6137" }),
      resuelto("ins-a", { linea: 4, cuota: 3, anulada: true, nota: "x" }), resuelto("ins-a", { linea: 5, cuota: 4 }),
    ], versiones);
    const conteos = contar(planes);
    expect(conteos).toEqual({ filas: 4, nuevos: 1, versiones: 1, anulaciones: 1, sinCambios: 1 });
    expect(hayCambios(conteos)).toBe(true);
    expect(hayCambios({ filas: 3, nuevos: 0, versiones: 0, anulaciones: 0, sinCambios: 3 })).toBe(false);
  });
});

describe("decretos · clave natural de la fila cruda", () => {
  it("la clave natural: sha256 de la clave del decreto y la versión; otra versión u otra clave dan otra; el contenido no cuenta", () => {
    const k = claveNaturalDecreto("ins-a", DECRETO, 1);
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(claveNaturalDecreto("ins-a", con({ valorPorAccion: "4.6137", nota: "x" }), 1)).toBe(k);
    expect(new Set([k, claveNaturalDecreto("ins-a", DECRETO, 2), claveNaturalDecreto("ins-b", DECRETO, 1), claveNaturalDecreto("ins-a", con({ cuota: 2 }), 1),
      claveNaturalDecreto("ins-a", con({ tipo: "EXTRAORDINARIO" }), 1), claveNaturalDecreto("ins-a", con({ fechaAnuncio: dia("2021-03-18") }), 1)]).size).toBe(6);
  });

});
