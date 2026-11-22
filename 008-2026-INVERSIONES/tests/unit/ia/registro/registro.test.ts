// src/ia/registro/registro.ts sin base, con un `resumenIa` falso: qué errores de escritura se vuelven BASE_RECHAZADA (sin
// el mensaje original, que trae la fila) y cuáles suben tal cual, y cuándo una fila guardada da GUARDADO_INVALIDO. Lo que
// pasa contra PostgreSQL lo prueban tests/integracion/ia/registro.test.ts y privilegios-ia.test.ts.
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { sha256Hex } from "@/ia/hash";
import { construirPaquete, leerPaquete } from "@/ia/paquete";
import type { EntradaResumen } from "@/ia/registro/fila";
import { registrarResumen, ultimoPublicado, type BaseRegistro } from "@/ia/registro/registro";
import { ENTRADAS_FICTICIAS } from "../apoyo/hechos.ficticio";

vi.mock("@/ia/paquete", async (original) => {
  const real = await original<typeof import("@/ia/paquete")>();
  return { ...real, leerPaquete: vi.fn(real.leerPaquete) };
});

const paquete = construirPaquete({ ...ENTRADAS_FICTICIAS.DIARIO(), avisos: ["REGISTRO_SIN_BASE"] });
const TEXTO = "Texto ficticio que nunca va en un error";
const entrada: EntradaResumen = {
  paquete, prompt: { version: "resumen-diario-v1", hash: sha256Hex("prompt ficticio sin base") }, opciones: { seed: 42 }, validadorVersion: "validador-v1",
  estado: "PUBLICADO", texto: TEXTO,
  exito: { ok: true, puerta: "local", salidaCruda: "{}", modelo: "ornith:9b", modeloDigest: "digest-ficticio", latenciaMs: 1913, tokensEntrada: 7, tokensSalida: 3 },
};
const conFalla = (error: unknown): BaseRegistro => ({ resumenIa: { createManyAndReturn: () => Promise.reject(error), create: () => Promise.reject(error) } }) as unknown as BaseRegistro;

describe("registrarResumen: errores de escritura", () => {
  it.each([
    ["un error conocido de la base (no el de la clave)", new Prisma.PrismaClientKnownRequestError(`fila ${TEXTO}`, { code: "P2010", clientVersion: "5.22.0" })],
    ["un error desconocido de la base (un CHECK)", new Prisma.PrismaClientUnknownRequestError(`Failing row contains (${TEXTO})`, { clientVersion: "5.22.0" })],
    ["un error de validación del cliente (trae los argumentos)", new Prisma.PrismaClientValidationError(`data: { texto: "${TEXTO}" }`, { clientVersion: "5.22.0" })],
  ])("%s sale como BASE_RECHAZADA, sin el mensaje ni la causa", async (_n, error) => {
    const { texto: _texto, ...sinTexto } = entrada as Extract<EntradaResumen, { estado: "PUBLICADO" }>;
    const rechazado: EntradaResumen = { ...sinTexto, estado: "RECHAZADO", motivos: ["LONGITUD"] };
    for (const e of [entrada, rechazado]) {
      const lanzado = await registrarResumen(conFalla(error), e).then(() => null, (x: unknown) => x as Error);
      expect(lanzado).toMatchObject({ name: "ErrorRegistro", codigo: "BASE_RECHAZADA" });
      expect(lanzado!.message).not.toContain(TEXTO);
      expect(lanzado!.cause).toBeUndefined();
    }
  });

  it("un error que no es de la base (un defecto del código) sube tal cual: no se esconde", async () => {
    const defecto = new TypeError("defecto ficticio");
    await expect(registrarResumen(conFalla(defecto), entrada)).rejects.toBe(defecto);
  });
});

describe("ultimoPublicado: lo guardado que no cuadra", () => {
  const fila = {
    id: "fila-ficticia", tipo: "DIARIO", fechaNegocio: new Date(`${paquete.hoy}T00:00:00.000Z`), puerta: "local", texto: TEXTO, salidaModelo: "{}",
    hechos: JSON.parse(JSON.stringify(paquete)) as unknown, hechosHash: paquete.hash, promptVersion: "resumen-diario-v1", promptHash: sha256Hex("p"),
    modelo: "ornith:9b", modeloDigest: "digest-ficticio", validadorVersion: "validador-v1", generadoEn: new Date("2027-03-17T23:41:00.000Z"),
  };
  const conFila = (cambio: Record<string, unknown>): BaseRegistro => ({ resumenIa: { findFirst: () => Promise.resolve({ ...fila, ...cambio }) } }) as unknown as BaseRegistro;

  it("control positivo: la fila tal cual se lee, con su paquete reconstruido", async () => {
    expect((await ultimoPublicado(conFila({}), "DIARIO", paquete.hoy))?.paquete).toEqual(paquete);
  });

  it.each<[string, Record<string, unknown>]>([
    ["sin puerta", { puerta: null }],
    ["sin texto", { texto: null }],
    ["sin salida", { salidaModelo: null }],
    ["sin modelo", { modelo: null }],
    ["sin digest", { modeloDigest: null }],
    ["con el hash de la columna distinto del paquete", { hechosHash: "b".repeat(64) }],
    ["con otro tipo en la columna", { tipo: "REGLAS" }],
    ["con otro día en la columna", { fechaNegocio: new Date("2027-03-18T00:00:00.000Z") }],
    ["con unos hechos que no se reconstruyen", { hechos: { version: "hechos-v1" } }],
  ])("%s da GUARDADO_INVALIDO", async (_n, cambio) => {
    await expect(ultimoPublicado(conFila(cambio), "DIARIO", paquete.hoy)).rejects.toThrow(expect.objectContaining({ codigo: "GUARDADO_INVALIDO" }));
  });

  it("un error de leerPaquete que no es ErrorPaquete (un defecto) sube tal cual", async () => {
    const defecto = new RangeError("defecto ficticio");
    vi.mocked(leerPaquete).mockImplementationOnce(() => {
      throw defecto;
    });
    await expect(ultimoPublicado(conFila({}), "DIARIO", paquete.hoy)).rejects.toBe(defecto);
  });
});
