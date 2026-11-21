// Candados de la migración (#11) que muerden antes de tocar la base: la base de esta prueba
// lanza si alguien la usa. El comportamiento contra PostgreSQL está en tests/integracion/cifrado.test.ts.
import type { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorArgumentos } from "@/cifrado/argumentos";
import { obtenerLlavero } from "@/cifrado/llavero";
import { cifrarExistentes, codigoDeSalida, ErrorMigracion, type ConteoTabla, type ResultadoMigracion } from "@/cifrado/migracion";

const baseIntocable = new Proxy({} as PrismaClient, {
  get: (_objetivo, propiedad) => {
    throw new Error(`la migración tocó la base (${String(propiedad)}) antes de validar`);
  },
});
const llavero = obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: "v1", CIFRADO_CLAVE_V1: randomBytes(32).toString("base64") });

afterEach(() => vi.unstubAllEnvs());

describe("cifrarExistentes · antes de tocar la base", () => {
  it.each([0, -1, 1.5, 5001, Number.NaN])("un lote inválido (%s): LOTE_INVALIDO", async (lote) => {
    const intento = cifrarExistentes(baseIntocable, { aplicar: true, reCifrar: false, base: "b_test", lote, llavero });
    await expect(intento).rejects.toBeInstanceOf(ErrorMigracion);
    await expect(intento).rejects.toMatchObject({ codigo: "LOTE_INVALIDO" });
  });

  it("sin llavero válido falla cerrado (ErrorCifrado) sin leer la base", async () => {
    vi.stubEnv("CIFRADO_CLAVE_ACTIVA", "");
    await expect(cifrarExistentes(baseIntocable, { aplicar: false, reCifrar: false })).rejects.toMatchObject({ name: "ErrorCifrado", codigo: "CLAVE_ACTIVA_AUSENTE" });
  });
});

const conteo = (extra: Partial<ConteoTabla> = {}): ConteoTabla => ({
  total: 3, enClaro: 0, anomalas: 0, porVersion: { v1: 3 }, sinClave: 0, noAbren: 0, concurrentes: 0, cifradasAhora: 0, reCifradasAhora: 0, ...extra,
});
const resultado = (filaFuente: Partial<ConteoTabla> = {}, certificacionFondo: Partial<ConteoTabla> = {}): ResultadoMigracion => ({
  base: "b_test", activa: "v1", escribe: true, filaFuente: conteo(filaFuente), certificacionFondo: conteo(certificacionFondo),
});

describe("codigoDeSalida del script", () => {
  it("0 sin alertas, aunque haya cifrado o re-cifrado", () => {
    expect(codigoDeSalida(resultado({ cifradasAhora: 5, reCifradasAhora: 2 }))).toBe(0);
  });

  it.each(["anomalas", "sinClave", "noAbren", "concurrentes"] as const)("1 si hay %s, en cualquiera de las dos tablas", (campo) => {
    expect(codigoDeSalida(resultado({ [campo]: 1 }))).toBe(1);
    expect(codigoDeSalida(resultado({}, { [campo]: 2 }))).toBe(1);
  });

  it("2 por un error de uso", () => {
    expect(codigoDeSalida(new ErrorArgumentos("Opción desconocida"))).toBe(2);
  });
});
