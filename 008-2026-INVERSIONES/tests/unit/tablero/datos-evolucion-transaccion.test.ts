// El lector de la evolución (frente graficas-tablero, hallazgo MEDIO del database-reviewer): lee en una sola foto
// REPEATABLE READ con su espera y su tope de tiempo explícitos (como la conciliación), no con los de Prisma por
// defecto (2 s / 5 s), que en el servidor compartido o con la base fría dan fallos espurios. Base falsa.
import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { obtenerEvolucion } from "@/tablero/datos-evolucion";
import { D, dia, especie, resumenDe } from "./ficticio";

describe("obtenerEvolucion · transacción", () => {
  it("una sola transacción REPEATABLE READ con maxWait 10 s y timeout 15 s", async () => {
    const transaccion = vi.fn(async () => [[], [], [], []]);
    const db = {
      $transaction: transaccion,
      lote: { findMany: vi.fn() }, orden: { findMany: vi.fn() }, dividendo: { findMany: vi.fn() }, precioCierre: { findMany: vi.fn() },
    } as unknown as PrismaClient;
    const r = resumenDe([especie({ nemotecnico: "FICTA", cantidad: 3n, costoVivo: D(3711), cierre: { precio: D("1237.41"), fecha: dia("2027-03-05"), verificado: false } })]);
    await obtenerEvolucion(db, r);
    expect(transaccion).toHaveBeenCalledTimes(1);
    expect(transaccion.mock.calls[0]![1]).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 10_000, timeout: 15_000 });
  });
});
