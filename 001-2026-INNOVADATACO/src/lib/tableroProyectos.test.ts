import { describe, it, expect } from "vitest";
import { agruparPorColumna, tarjetasHuerfanas } from "./kanban";
import { columnasDeFases, tarjetasDeProyectos, type ProyectoTablero } from "./tableroProyectos";

const PROYECTOS: ProyectoTablero[] = [
  { id: "p1", codigo: "PRY-001", nombre: "Piloto", cliente: "IDC", currentPhase: "initiation" },
  { id: "p2", codigo: "PRY-002", nombre: "SICOV", cliente: "OTPC", currentPhase: "execution" },
  { id: "p3", codigo: "PRY-003", nombre: "Cerrado", cliente: "", currentPhase: "closing" },
];

describe("columnasDeFases (spec 008, FR-005 / SC-003)", () => {
  it("son 4 columnas: Inicio · Planeación · Ejecución · Cierre", () => {
    const columnas = columnasDeFases();

    expect(columnas).toHaveLength(4);
    expect(columnas.map((c) => c.titulo)).toEqual(["Inicio", "Planeación", "Ejecución", "Cierre"]);
  });

  it("las columnas se identifican por la clave persistida en currentPhase", () => {
    expect(columnasDeFases().map((c) => c.id)).toEqual([
      "initiation",
      "planning",
      "execution",
      "closing",
    ]);
  });
});

describe("tarjetasDeProyectos (spec 008, US2-1)", () => {
  it("ubica cada proyecto como tarjeta en la columna de su fase actual", () => {
    const grupos = agruparPorColumna(columnasDeFases(), tarjetasDeProyectos(PROYECTOS));

    expect(grupos[0].tarjetas.map((t) => t.id)).toEqual(["p1"]);
    expect(grupos[1].tarjetas).toEqual([]);
    expect(grupos[2].tarjetas.map((t) => t.id)).toEqual(["p2"]);
    expect(grupos[3].tarjetas.map((t) => t.id)).toEqual(["p3"]);
  });

  it("muestra código y cliente para identificar el proyecto sin abrirlo", () => {
    const [tarjeta] = tarjetasDeProyectos(PROYECTOS);

    expect(tarjeta.titulo).toBe("Piloto");
    expect(tarjeta.referencia).toBe("PRY-001");
    expect(tarjeta.etiqueta).toBe("IDC");
  });

  it("un proyecto sin cliente no rompe la tarjeta", () => {
    const [, , tarjeta] = tarjetasDeProyectos(PROYECTOS);

    expect(tarjeta.etiqueta).toBeUndefined();
  });

  it("un proyecto con fase heredada desconocida queda huérfano, sin romper el tablero (R-02)", () => {
    const conRara = [
      ...PROYECTOS,
      { id: "p9", codigo: "PRY-009", nombre: "Raro", cliente: "X", currentPhase: "fase-vieja" },
    ];
    const columnas = columnasDeFases();
    const tarjetas = tarjetasDeProyectos(conRara);

    expect(agruparPorColumna(columnas, tarjetas).flatMap((g) => g.tarjetas.map((t) => t.id))).not.toContain("p9");
    expect(tarjetasHuerfanas(columnas, tarjetas).map((t) => t.id)).toEqual(["p9"]);
  });
});
