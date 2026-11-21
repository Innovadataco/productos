// Mapeo de la estructura intermedia a los datos del dominio, con las validaciones puras del corte 1
// ANTES de escribir (fase B, corte 2). Datos inventados.
import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { leerFicha } from "@/plan/importar/interpretar";
import { claveRegla, prepararImportacion } from "@/plan/importar/mapear";
import type { PlanLeido } from "@/plan/importar/tipos";
import { MAX_TEXTO } from "@/plan/validar";

const FIXTURE = readFileSync(new URL("../../fixtures/ficha.ficticio.md", import.meta.url), "utf8");
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const PLAN: PlanLeido = leerFicha(FIXTURE).plan!;
const ESPECIES = new Map([
  ["FICTA", "inst-a"],
  ["FICTB", "inst-b"],
]);
const HOY = dia("2025-03-31");

describe("prepararImportacion", () => {
  it("resuelve las especies, conserva el orden de las reglas y deja cada decisión apuntando a su regla", () => {
    const p = prepararImportacion(PLAN, ESPECIES, HOY);
    expect(p.bloqueos).toEqual([]);
    expect([p.version.vigenteDesde, p.version.motivo]).toEqual([dia("2025-03-15"), PLAN.motivo]);
    expect(p.version.reglas.map((r) => r.instrumentoId)).toEqual(["inst-a", "inst-b", "inst-b", null, null, null, null, null, null]);
    expect(p.decisiones.map((d) => [d.instrumentoId, d.accion, d.cantidad, d.indiceRegla, d.excepcion, d.reglaId, d.linea])).toEqual([
      ["inst-a", "VENDER", 120n, 0, false, null, 23],
      ["inst-b", "NO_ACTUAR", 250n, 1, false, null, 24],
    ]);
  });

  it("una especie sin instrumento en la base bloquea con la línea de cada regla, una vez por línea", () => {
    const p = prepararImportacion(PLAN, new Map([["FICTA", "inst-a"]]), HOY);
    expect(p.bloqueos.map((b) => [b.linea, b.codigo])).toEqual([[24, "ESPECIE_SIN_INSTRUMENTO"]]);
  });

  it("una decisión con fecha posterior a hoy se rechaza antes de escribir, con su línea", () => {
    const p = prepararImportacion(PLAN, ESPECIES, dia("2025-03-14"));
    expect(p.bloqueos.map((b) => [b.linea, b.campo, b.codigo])).toEqual([
      [23, "fechaDecision", "FECHA_FUTURA"],
      [24, "fechaDecision", "FECHA_FUTURA"],
    ]);
  });

  it("una decisión anterior a la vigencia de su versión se rechaza antes de escribir (la versión quedaría huérfana)", () => {
    const plan: PlanLeido = { ...PLAN, decisiones: PLAN.decisiones.map((d, i) => (i === 0 ? { ...d, fechaDecision: dia("2025-03-14") } : d)) };
    const p = prepararImportacion(plan, ESPECIES, HOY);
    expect(p.bloqueos.map((b) => [b.linea, b.campo, b.codigo])).toEqual([[23, "fechaDecision", "DECISION_ANTES_DE_VIGENCIA"]]);
  });

  it("una vigencia a más de un año de hoy se rechaza en la línea del encabezado", () => {
    const p = prepararImportacion(PLAN, ESPECIES, dia("2024-01-01"));
    expect(p.bloqueos.filter((b) => b.linea === PLAN.linea).map((b) => [b.campo, b.codigo])).toEqual([["vigenteDesde", "VIGENCIA_DEMASIADO_LEJANA"]]);
  });

  it("un detalle demasiado largo se reporta en la línea de su regla", () => {
    const largo = "x".repeat(MAX_TEXTO + 1);
    const plan: PlanLeido = { ...PLAN, reglas: PLAN.reglas.map((r, i) => (i === 3 ? { ...r, detalle: largo } : r)) };
    const p = prepararImportacion(plan, ESPECIES, HOY);
    expect(p.bloqueos.map((b) => [b.linea, b.campo, b.codigo])).toEqual([[25, "detalle", "DEMASIADO_LARGO"]]);
  });

  it("un motivo de decisión demasiado largo se reporta en la línea de la decisión", () => {
    const largo = "x".repeat(MAX_TEXTO + 1);
    const plan: PlanLeido = { ...PLAN, decisiones: PLAN.decisiones.map((d, i) => (i === 1 ? { ...d, motivo: largo } : d)) };
    const p = prepararImportacion(plan, ESPECIES, HOY);
    expect(p.bloqueos.map((b) => [b.linea, b.campo, b.codigo])).toEqual([[24, "motivo", "DEMASIADO_LARGO"]]);
  });
});

describe("claveRegla (idempotencia sin columnas nuevas)", () => {
  const base = { instrumentoId: "inst-a", condicion: "CIERRE_BAJO", nivel: "1111", accion: "VENDER", cantidad: null, plazoHasta: null, detalle: "texto" };

  it("el nivel de la base (Decimal con ceros) y el de la ficha dan la misma clave", () => {
    expect(claveRegla({ ...base, nivel: new Prisma.Decimal("1111.000000") })).toBe(claveRegla(base));
  });

  it("el detalle se compara recortado, como lo guarda crearVersionPlan", () => {
    expect(claveRegla({ ...base, detalle: "  texto " })).toBe(claveRegla(base));
  });

  it("cualquier campo distinto da otra clave", () => {
    const otras = [{ nivel: "3333" }, { cantidad: 1n }, { accion: "COMPRAR" }, { instrumentoId: null }, { detalle: "otro" }, { plazoHasta: dia("2025-06-30") }];
    for (const cambio of otras) expect(claveRegla({ ...base, ...cambio })).not.toBe(claveRegla(base));
  });
});
