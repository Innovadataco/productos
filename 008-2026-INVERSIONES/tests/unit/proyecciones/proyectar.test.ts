// `proyectar` (servidor) con el lector simulado: el tope de trabajo cuenta también las columnas (security-reviewer M1),
// porque el costo real es trayectorias × ruedas × posiciones; y el camino feliz devuelve el resultado.
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { calcularProyeccion } from "@/proyecciones/calcular";
import { MAX_PASOS } from "@/proyecciones/metodo";
import { ErrorTrabajo } from "@/proyecciones/simulacion";
import type { ParametrosProyeccion } from "@/proyecciones/tipos";
import { accion, diasHabiles, entradas, serieAleatoria } from "./ficticio";

const muchas = (n: number) => {
  const dias = diasHabiles("2019-01-02", 1500);
  return entradas(Array.from({ length: n }, (_, k) => accion(`a${k}`, 37 + k, serieAleatoria(dias, 811.3 + k * 13.7, 300 + k))));
};

vi.mock("@/proyecciones/leer", () => ({ leerEntradas: vi.fn(async () => muchas(17)) }));

const P = (cambios: Partial<ParametrosProyeccion> = {}): ParametrosProyeccion => ({
  horizonteMeses: 120, aportePeriodico: 0, frecuenciaAporte: "MENSUAL", reinvertirDividendos: true, caidaInicialPct: 0, trayectorias: 10_000, semilla: 4613, ...cambios,
});

describe("tope de trabajo con las columnas", () => {
  it("el tope es de 400 millones de pasos (posición × rueda × trayectoria)", () => {
    expect(MAX_PASOS).toBe(400_000_000);
  });

  it("17 posiciones × 10.000 trayectorias × 10 años pasan el tope: se rechaza sin simular", () => {
    expect(() => calcularProyeccion(muchas(17), P())).toThrow(ErrorTrabajo);
  });

  it("proyectar lo devuelve como DEMASIADO_TRABAJO; con menos trayectorias, proyecta", async () => {
    const { proyectar } = await import("@/proyecciones/proyectar");
    const base = {} as PrismaClient;
    expect(await proyectar(base, P())).toEqual({ ok: false, errores: [{ campo: "trayectorias", codigo: "DEMASIADO_TRABAJO" }] });
    const r = await proyectar(base, P({ trayectorias: 53, horizonteMeses: 3 }));
    expect(r.ok && r.resultado.puntos.length).toBe(4);
  });
});
