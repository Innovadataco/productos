import { describe, it, expect } from "vitest";
import { evaluarIndexabilidad } from "./indexabilidad";

describe("evaluarIndexabilidad (spec 013, FR-002)", () => {
  it("con fragmentos es buscable, y no hay nada que explicar", () => {
    expect(evaluarIndexabilidad({ status: "completed", contenidoTexto: "texto", chunks: 12 })).toEqual(
      { buscable: true, enProceso: false, motivo: null },
    );
  });

  it("un documento con fragmentos es buscable AUNQUE esté en needs_review (SC-005)", () => {
    // Caso real de la BD viva: `ley 2199 de 2022`, 68 fragmentos, en
    // needs_review solo porque no había modelo de IA para enriquecerlo.
    const resultado = evaluarIndexabilidad({
      status: "needs_review",
      contenidoTexto: "88 mil caracteres…",
      processingError: "Sin modelo IA activo",
      chunks: 68,
    });

    expect(resultado.buscable).toBe(true);
    expect(resultado.motivo).toBeNull();
  });

  it("sin texto y sin fragmentos: no se pudo leer el PDF (SC-001)", () => {
    // Caso real: `SuperTransporte Circular 164`, Timeout, 0 caracteres.
    const resultado = evaluarIndexabilidad({
      status: "needs_review",
      contenidoTexto: "",
      processingError: "Timeout extrayendo texto del PDF",
      chunks: 0,
    });

    expect(resultado.buscable).toBe(false);
    expect(resultado.enProceso).toBe(false);
    expect(resultado.motivo).toContain("No se pudo leer el texto del PDF");
  });

  it("distingue 'no se leyó' de 'se leyó pero no se indexó'", () => {
    const conTexto = evaluarIndexabilidad({
      status: "needs_review",
      contenidoTexto: "hay texto de sobra",
      processingError: "Vectorización: error",
      chunks: 0,
    });

    expect(conTexto.buscable).toBe(false);
    expect(conTexto.motivo).toContain("no llegó a indexarse");
    expect(conTexto.motivo).not.toContain("No se pudo leer");
  });

  it("un documento en curso NO es 'no indexable': es 'todavía no' (FR-004)", () => {
    for (const status of ["pending", "queued", "processing"]) {
      const resultado = evaluarIndexabilidad({ status, contenidoTexto: "", chunks: 0 });

      expect(resultado.enProceso).toBe(true);
      expect(resultado.buscable).toBe(false);
      // Sin motivo: no hay nada que reprocharle todavía.
      expect(resultado.motivo).toBeNull();
    }
  });

  it("un texto de solo espacios cuenta como texto ausente", () => {
    expect(
      evaluarIndexabilidad({ status: "needs_review", contenidoTexto: "   \n  ", chunks: 0 }).motivo,
    ).toContain("No se pudo leer");
  });

  it("acepta contenidoTexto nulo o ausente sin lanzar", () => {
    expect(evaluarIndexabilidad({ status: "error", contenidoTexto: null, chunks: 0 }).buscable).toBe(
      false,
    );
    expect(evaluarIndexabilidad({ status: "error", chunks: 0 }).buscable).toBe(false);
  });
});

describe("SC-006 enmendado (SPEC-003, D-071): indexable sin chunks = 0", () => {
  // El criterio corregido: todo documento que se dé por BUSCABLE debe tener
  // fragmentos; los no buscables están marcados y se cuentan aparte. Se
  // verifica sobre los tres casos reales de la BD viva del turno 014.
  const corpusVivo = [
    { status: "needs_review", contenidoTexto: "292 chars", chunks: 1 }, // RESOLUCION 1234
    { status: "needs_review", contenidoTexto: "", chunks: 0 }, // SuperTransporte (Timeout)
    { status: "needs_review", contenidoTexto: "88k chars", chunks: 68 }, // ley 2199
  ];

  it("ningún documento buscable tiene cero fragmentos", () => {
    const buscablesSinChunks = corpusVivo
      .map((doc) => ({ doc, ind: evaluarIndexabilidad(doc) }))
      .filter(({ doc, ind }) => ind.buscable && doc.chunks === 0);

    expect(buscablesSinChunks).toEqual([]);
  });

  it("los no buscables están marcados con motivo y se cuentan aparte", () => {
    const noBuscables = corpusVivo
      .map((doc) => evaluarIndexabilidad(doc))
      .filter((ind) => !ind.buscable && !ind.enProceso);

    // El de Timeout: 1 no buscable, con su motivo. No es un incumplimiento
    // silencioso, es un hueco marcado.
    expect(noBuscables).toHaveLength(1);
    expect(noBuscables[0].motivo).toBeTruthy();
  });
});
