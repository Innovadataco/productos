import { describe, it, expect } from "vitest";
import { agruparPorColumna } from "./kanban";
import {
  columnasDeEstados,
  tarjetasDeOportunidades,
  type EstadoCatalogo,
  type OportunidadTablero,
} from "./tableroOportunidades";

const ESTADOS: EstadoCatalogo[] = [
  { id: 1, key: "abierta", nombreOficial: "Abierta" },
  { id: 2, key: "en-proceso", nombreOficial: "En proceso" },
  { id: 3, key: "cerrada", nombreOficial: "Cerrada" },
];

const OPORTUNIDADES: OportunidadTablero[] = [
  { id: "o1", titulo: "Suministro de equipos", numero: "L-001", estadoId: 1, tipo: { nombreOficial: "Licitación pública" } },
  { id: "o2", titulo: "Consultoría PMO", numero: null, estadoId: 3, tipo: null },
];

describe("columnasDeEstados (spec 007, FR-003 / SC-001)", () => {
  it("crea una columna por estado del catálogo, en su orden", () => {
    const columnas = columnasDeEstados(ESTADOS);

    expect(columnas).toHaveLength(3);
    expect(columnas.map((c) => c.titulo)).toEqual(["Abierta", "En proceso", "Cerrada"]);
    expect(columnas.map((c) => c.id)).toEqual(["1", "2", "3"]);
  });

  it("un estado NUEVO del catálogo aparece con acento neutro, sin tocar código (RZ-2, US4-1)", () => {
    const columnas = columnasDeEstados([
      ...ESTADOS,
      { id: 9, key: "prorrogada", nombreOficial: "Prorrogada" },
    ]);

    const nueva = columnas.find((c) => c.id === "9");
    expect(nueva?.titulo).toBe("Prorrogada");
    expect(nueva?.acento).toBeTruthy();
  });

  it("un estado renombrado muestra el nombre nuevo (US4-2)", () => {
    const columnas = columnasDeEstados([{ id: 1, key: "abierta", nombreOficial: "Abierta al público" }]);

    expect(columnas[0].titulo).toBe("Abierta al público");
  });

  it("con catálogo vacío devuelve cero columnas (Edge Case)", () => {
    expect(columnasDeEstados([])).toEqual([]);
  });
});

describe("tarjetasDeOportunidades (spec 007, FR-004 / SC-002)", () => {
  it("ubica cada oportunidad en la columna de su estado actual", () => {
    const grupos = agruparPorColumna(columnasDeEstados(ESTADOS), tarjetasDeOportunidades(OPORTUNIDADES));

    expect(grupos[0].tarjetas.map((t) => t.id)).toEqual(["o1"]);
    expect(grupos[1].tarjetas).toEqual([]);
    expect(grupos[2].tarjetas.map((t) => t.id)).toEqual(["o2"]);
  });

  it("muestra título, número y tipo para identificarla sin abrirla (US1-5)", () => {
    const [tarjeta] = tarjetasDeOportunidades(OPORTUNIDADES);

    expect(tarjeta.titulo).toBe("Suministro de equipos");
    expect(tarjeta.referencia).toBe("L-001");
    expect(tarjeta.etiqueta).toBe("Licitación pública");
  });

  it("una oportunidad sin número ni tipo no rompe la tarjeta (spec 006: ambos son opcionales)", () => {
    const [, tarjeta] = tarjetasDeOportunidades(OPORTUNIDADES);

    expect(tarjeta.titulo).toBe("Consultoría PMO");
    expect(tarjeta.referencia).toBeUndefined();
    expect(tarjeta.etiqueta).toBeUndefined();
  });

  it("una oportunidad con estado inexistente queda huérfana, sin romper el tablero (US1-2)", () => {
    const conRota = [...OPORTUNIDADES, { id: "o3", titulo: "Rota", numero: null, estadoId: 99 }];

    const grupos = agruparPorColumna(columnasDeEstados(ESTADOS), tarjetasDeOportunidades(conRota));

    expect(grupos.flatMap((g) => g.tarjetas.map((t) => t.id))).not.toContain("o3");
    expect(grupos).toHaveLength(3);
  });
});
