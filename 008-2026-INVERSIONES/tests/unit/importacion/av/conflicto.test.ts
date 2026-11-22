/**
 * Un choque con otra corrida (frente certificacion-corte-real; code-reviewer y security-reviewer BAJO): la corrección
 * del corte (o una importación) que choca con una corrida simultánea de precios (ConflictoConcurrente de la
 * re-verificación) o con una serialización de la base (P2034) se informa con un código propio, CONFLICTO_CONCURRENTE,
 * y el CLI dice que basta repetir; no un BASE_ERROR opaco. Nunca el mensaje del error.
 */
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { ResultadoCorreccion } from "@/importacion/av/corregir";
import { errorDe } from "@/importacion/av/importar";
import { lineasDeCorreccion } from "@/importacion/av/salida";
import { ConflictoConcurrente } from "@/precios/guardar";

describe("CONFLICTO_CONCURRENTE", () => {
  it("errorDe: el choque de la re-verificación y la serialización de la base (P2034) dan CONFLICTO_CONCURRENTE", () => {
    expect(errorDe(new ConflictoConcurrente()).codigo).toBe("CONFLICTO_CONCURRENTE");
    expect(errorDe(new Prisma.PrismaClientKnownRequestError("detalle 37911", { code: "P2034", clientVersion: "5.22.0" })).codigo).toBe("CONFLICTO_CONCURRENTE");
    expect(errorDe(new Prisma.PrismaClientKnownRequestError("detalle 37911", { code: "P2003", clientVersion: "5.22.0" })).codigo).toBe("BASE_P2003");
  });

  it("la salida de la corrección dice que nada cambió y que basta repetir", () => {
    const r: ResultadoCorreccion = {
      estado: "RECHAZADO", codigo: "CONFLICTO_CONCURRENTE", pistaCorte: null, retiradaId: null, nuevaId: null, cargaId: "c3", filas: 0, cargasRevertidas: 0, reverificados: { anterior: 0, nuevo: 0 },
    };
    const texto = lineasDeCorreccion(r, "2027-07-13", "2027-07-12", false).join("\n");
    expect(texto).toContain("❌ RECHAZADO (nada cambió) · CONFLICTO_CONCURRENTE");
    expect(texto).toContain("repita el mismo comando");
  });
});
