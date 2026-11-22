/**
 * La foto de solo lectura del export (E7), sin base: UNA transacción interactiva REPEATABLE READ cuyo primer comando es
 * `SET TRANSACTION READ ONLY`, y un cliente que los lectores de siempre usan como un PrismaClient: los modelos son los de
 * la transacción, y su `$transaction` (con función o con lista) corre dentro de la misma foto, sin abrir otra.
 * La integración (tests/integracion/ia/evaluacion/exportar.test.ts) prueba contra la base que un INSERT falla.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { clienteDeLaFoto, enFotoDeSoloLectura, OPCIONES_FOTO } from "@/ia/evaluacion/exportar/foto";

function baseFalsa() {
  const pasos: string[] = [];
  const opciones: unknown[] = [];
  const tx = {
    $executeRaw: (partes: TemplateStringsArray) => {
      pasos.push(`sql:${partes.join("?")}`);
      return Promise.resolve(0);
    },
    instrumento: { count: () => {
      pasos.push("instrumento.count");
      return Promise.resolve(13);
    } },
  };
  const db = {
    $transaction: (fn: (t: unknown) => Promise<unknown>, o: unknown) => {
      pasos.push("abrir");
      opciones.push(o);
      return fn(tx);
    },
  };
  return { db: db as unknown as PrismaClient, tx: tx as unknown as Prisma.TransactionClient, pasos, opciones };
}

describe("enFotoDeSoloLectura", () => {
  it("abre UNA transacción REPEATABLE READ, primero SET TRANSACTION READ ONLY y después la lectura", async () => {
    const b = baseFalsa();
    const r = await enFotoDeSoloLectura(b.db, (c) => c.instrumento.count());
    expect(r).toBe(13);
    expect(b.pasos).toEqual(["abrir", "sql:SET TRANSACTION READ ONLY", "instrumento.count"]);
    expect(b.opciones).toEqual([OPCIONES_FOTO]);
    expect(OPCIONES_FOTO.isolationLevel).toBe(Prisma.TransactionIsolationLevel.RepeatableRead);
    expect(OPCIONES_FOTO.timeout).toBeGreaterThanOrEqual(60_000);
  });
});

describe("clienteDeLaFoto", () => {
  it("los modelos son los de la transacción", async () => {
    const b = baseFalsa();
    expect(await clienteDeLaFoto(b.tx).instrumento.count()).toBe(13);
  });

  it("$transaction con función corre dentro de la misma foto (anidado), sin abrir otra", async () => {
    const b = baseFalsa();
    const c = clienteDeLaFoto(b.tx);
    const r = await c.$transaction(async (t) => (t as unknown as PrismaClient).$transaction(async (u) => (u as unknown as PrismaClient).instrumento.count()));
    expect(r).toBe(13);
    expect(b.pasos).toEqual(["instrumento.count"]);
  });

  it("$transaction con una lista espera todas las consultas, en la misma foto", async () => {
    const b = baseFalsa();
    const c = clienteDeLaFoto(b.tx);
    expect(await c.$transaction([c.instrumento.count(), c.instrumento.count()])).toEqual([13, 13]);
    expect(b.pasos).toEqual(["instrumento.count", "instrumento.count"]);
  });

  it("$transaction con otra cosa rechaza con TypeError", async () => {
    const c = clienteDeLaFoto(baseFalsa().tx) as unknown as { $transaction: (x: unknown) => Promise<unknown> };
    await expect(c.$transaction("no es una lectura")).rejects.toThrow(TypeError);
  });
});
