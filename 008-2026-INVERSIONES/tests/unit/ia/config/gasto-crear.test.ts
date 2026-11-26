/**
 * Los bordes de `gastoNubeDelMes`, `leerGastoNube` y `crearVersionConfigIa` con una base falsa (sin PostgreSQL): más
 * corridas que el tope (GASTO_NO_VERIFICABLE, no se adivina), la dependencia `gastoDelMes` de la nube con el gasto
 * valorado, y un error de la base que no es un choque ni un autor inexistente (se propaga tal cual). Lo demás lo prueba
 * la integración. Datos inventados.
 */
import { describe, expect, it, vi } from "vitest";
import { crearVersionConfigIa } from "@/ia/config/crear";
import { ErrorConfigIa } from "@/ia/config/errores";
import { MAX_CORRIDAS_GASTO, gastoNubeDelMes, leerGastoNube } from "@/ia/config/gasto";
import { costoTokensMicroUsd, esGastoDelMes } from "@/ia/nube/tope";

const base = (filas: readonly unknown[]) => ({ resumenIa: { findMany: vi.fn(() => Promise.resolve(filas)) } }) as never;

describe("gastoNubeDelMes · bordes", () => {
  it("con más de MAX_CORRIDAS_GASTO corridas en el mes: GASTO_NO_VERIFICABLE", async () => {
    const filas = Array.from({ length: MAX_CORRIDAS_GASTO + 1 }, () => ({ modeloDigest: "claude-haiku-5-5", tokensEntrada: 1, tokensSalida: 1 }));
    await expect(gastoNubeDelMes(base(filas), "2027-03-17")).rejects.toThrow(new ErrorConfigIa("GASTO_NO_VERIFICABLE"));
  });

  it("los FALLIDO (sin tokens) cuentan 0 y un digest nulo se cobra como opus", async () => {
    const g = await gastoNubeDelMes(base([{ modeloDigest: null, tokensEntrada: null, tokensSalida: null }, { modeloDigest: null, tokensEntrada: 41, tokensSalida: 7 }]), "2027-03-17");
    expect(g).toEqual({ mes: "2027-03", tokensEntrada: 41, tokensSalida: 7, microUsd: costoTokensMicroUsd("claude-opus-5-5", 41, 7), corridas: 2 });
  });
});

describe("leerGastoNube · la dependencia gastoDelMes de la puerta nube", () => {
  it("devuelve el gasto del mes de hoy, valorado y con la forma que exige la nube", async () => {
    const leer = leerGastoNube(base([{ modeloDigest: "claude-sonnet-5-5", tokensEntrada: 1237, tokensSalida: 211 }]), () => "2027-04-13");
    const g = await leer();
    expect(g).toEqual({ mes: "2027-04", tokensEntrada: 1237, tokensSalida: 211, microUsd: costoTokensMicroUsd("claude-sonnet-5-5", 1237, 211) });
    expect(esGastoDelMes(g)).toBe(true);
  });
});

describe("crearVersionConfigIa · un error de la base que no es suyo se propaga", () => {
  it("lanza el error original (la ruta lo vuelve un 500 genérico)", async () => {
    const error = new Error("fallo ficticio de la base");
    const db = { configIa: { findFirst: () => Promise.resolve(null), create: () => Promise.reject(error) } } as never;
    const entrada = {
      modo: "apagado", ollamaHost: null, ollamaPuerto: null, temperaturaCentesimas: 0,
      tareas: { DIARIO: { activo: false, modeloLocal: null }, REGLAS: { activo: false, modeloLocal: null }, ESCENARIOS: { activo: false, modeloLocal: null } },
      modeloNube: "claude-opus-5-5", esfuerzoNube: "low", topeMicroUsd: null, horaResumen: "19:00", limiteSegundos: 60, analisisDemanda: false, motivo: "Ficticio",
    } as const;
    await expect(crearVersionConfigIa(db, entrada, { autorId: "u-1237", ultimaEsperada: 0 })).rejects.toBe(error);
  });
});
