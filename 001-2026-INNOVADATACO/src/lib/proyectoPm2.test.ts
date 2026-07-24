import { describe, it, expect } from "vitest";
import {
  validarHito,
  datosHito,
  validarPartidaProyecto,
  datosPartida,
  resumirPresupuesto,
  validarRecurso,
  datosRecurso,
  validarLeccion,
  datosLeccion,
  TIPOS_RECURSO,
} from "./proyectoPm2";

describe("US4 · Cronograma — validarHito (spec 008, FR-011)", () => {
  it("acepta un hito con nombre y fecha", () => {
    expect(validarHito({ nombre: "Kickoff", fecha: "2026-09-01" })).toBeNull();
  });

  it("acepta una actividad con periodo", () => {
    expect(
      validarHito({ nombre: "Ejecución", fecha: "2026-09-01", fechaFin: "2026-12-31" }),
    ).toBeNull();
  });

  it("exige nombre", () => {
    expect(validarHito({ fecha: "2026-09-01" })).toBe("El nombre del hito es obligatorio");
    expect(validarHito({ nombre: "  ", fecha: "2026-09-01" })).toBe(
      "El nombre del hito es obligatorio",
    );
  });

  it("exige fecha y la valida como fecha real (US4-2)", () => {
    expect(validarHito({ nombre: "X" })).toBe("La fecha del hito es obligatoria");
    expect(validarHito({ nombre: "X", fecha: "el mes que viene" })).toBe(
      "La fecha del hito no es una fecha válida",
    );
  });

  it("rechaza un periodo que termina antes de empezar: no es raro, es imposible", () => {
    expect(
      validarHito({ nombre: "X", fecha: "2026-12-31", fechaFin: "2026-01-01" }),
    ).toBe("La fecha de fin no puede ser anterior a la de inicio");
  });

  it("normaliza las fechas y deja fechaFin en null si no viene", () => {
    const datos = datosHito({ nombre: " Kickoff ", fecha: "2026-09-01" });

    expect(datos.nombre).toBe("Kickoff");
    expect(datos.fecha.toISOString().slice(0, 10)).toBe("2026-09-01");
    expect(datos.fechaFin).toBeNull();
  });
});

describe("US5 · Presupuesto — validarPartidaProyecto (spec 008, FR-012)", () => {
  it("acepta una partida con planeado y ejecutado", () => {
    expect(
      validarPartidaProyecto({ concepto: "Personal", montoPlaneado: 1000, montoEjecutado: 250 }),
    ).toBeNull();
  });

  it("exige concepto", () => {
    expect(validarPartidaProyecto({ montoPlaneado: 10 })).toBe(
      "El concepto de la partida es obligatorio",
    );
  });

  it("rechaza montos negativos o no numéricos (US5-2)", () => {
    expect(validarPartidaProyecto({ concepto: "X", montoPlaneado: -1 })).toContain("no negativo");
    expect(validarPartidaProyecto({ concepto: "X", montoEjecutado: "mucho" })).toContain(
      "no negativo",
    );
  });

  it("los montos ausentes valen 0 y la moneda por defecto es COP", () => {
    expect(datosPartida({ concepto: "Viáticos" })).toEqual({
      concepto: "Viáticos",
      montoPlaneado: 0,
      montoEjecutado: 0,
      moneda: "COP",
    });
  });
});

describe("US5 · Control de gasto — resumirPresupuesto (spec 008, SC-007)", () => {
  it("suma planeado, ejecutado y calcula la desviación", () => {
    expect(
      resumirPresupuesto([
        { montoPlaneado: 1000, montoEjecutado: 800 },
        { montoPlaneado: 500, montoEjecutado: 300 },
      ]),
    ).toEqual({ totalPlaneado: 1500, totalEjecutado: 1100, desviacion: -400 });
  });

  it("el sobrecoste se MUESTRA como desviación positiva, no se impide (Edge Case)", () => {
    const resumen = resumirPresupuesto([{ montoPlaneado: 1000, montoEjecutado: 1250.5 }]);

    expect(resumen.desviacion).toBe(250.5);
    expect(resumen.totalEjecutado).toBeGreaterThan(resumen.totalPlaneado);
  });

  it("sin partidas todo queda en cero, no en NaN", () => {
    expect(resumirPresupuesto([])).toEqual({
      totalPlaneado: 0,
      totalEjecutado: 0,
      desviacion: 0,
    });
  });

  it("acepta los Decimal de Prisma, que llegan como string", () => {
    expect(resumirPresupuesto([{ montoPlaneado: "1000.00", montoEjecutado: "1250.50" }])).toEqual({
      totalPlaneado: 1000,
      totalEjecutado: 1250.5,
      desviacion: 250.5,
    });
  });
});

describe("US5 · Recursos — validarRecurso (spec 008, FR-013)", () => {
  it("acepta un recurso con sus cuatro datos", () => {
    expect(
      validarRecurso({
        nombre: "Ana",
        rol: "Líder técnica",
        tipo: "humano",
        costo: 5000,
        disponibilidad: "50%",
      }),
    ).toBeNull();
  });

  it("exige nombre", () => {
    expect(validarRecurso({ tipo: "humano" })).toBe("El nombre del recurso es obligatorio");
  });

  it("acepta los dos tipos y rechaza un tercero", () => {
    for (const tipo of TIPOS_RECURSO) expect(validarRecurso({ nombre: "X", tipo })).toBeNull();
    expect(validarRecurso({ nombre: "X", tipo: "extraterrestre" })).toContain(
      "Tipo de recurso no válido",
    );
  });

  it("un material sin rol es válido: el rol aplica a humanos (Edge Case)", () => {
    expect(validarRecurso({ nombre: "Camioneta", tipo: "material", costo: 200 })).toBeNull();
    expect(datosRecurso({ nombre: "Camioneta", tipo: "material" }).rol).toBe("");
  });

  it("rechaza costo negativo", () => {
    expect(validarRecurso({ nombre: "X", costo: -5 })).toContain("no negativo");
  });
});

describe("US6 · Lecciones — validarLeccion (spec 008, FR-014)", () => {
  it("acepta una lección solo con descripción", () => {
    expect(validarLeccion({ descripcion: "Estimar con holgura" })).toBeNull();
  });

  it("exige descripción", () => {
    expect(validarLeccion({ categoria: "gestión" })).toBe(
      "La descripción de la lección es obligatoria",
    );
  });

  it("categoría e impacto son opcionales y quedan vacíos, no indefinidos", () => {
    expect(datosLeccion({ descripcion: "  Documentar antes  " })).toEqual({
      descripcion: "Documentar antes",
      categoria: "",
      impacto: "",
    });
  });
});
