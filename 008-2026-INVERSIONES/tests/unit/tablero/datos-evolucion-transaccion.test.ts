// El lector de la evolución (frente graficas-tablero): lee las cuatro tablas en UNA foto REPEATABLE READ.
// El database-reviewer pidió además maxWait y timeout (MEDIO); no aplica: es un $transaction de arreglo y en
// Prisma 5.22 esas opciones son solo de las transacciones interactivas (el tipo no las admite: TS2769). Base falsa.
import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { obtenerEvolucion } from "@/tablero/datos-evolucion";
import { D, dia, especie, resumenDe } from "./ficticio";

describe("obtenerEvolucion · transacción", () => {
  it("una sola transacción REPEATABLE READ con las cuatro consultas", async () => {
    const transaccion = vi.fn(async (consultas: readonly unknown[], _opciones: unknown) => consultas.map(() => []));
    const db = {
      $transaction: transaccion,
      lote: { findMany: vi.fn() }, orden: { findMany: vi.fn() }, dividendo: { findMany: vi.fn() }, precioCierre: { findMany: vi.fn() },
    } as unknown as PrismaClient;
    const r = resumenDe([especie({ nemotecnico: "FICTA", cantidad: 3n, costoVivo: D(3711), cierre: { precio: D("1237.41"), fecha: dia("2027-03-05"), verificado: false } })]);
    await obtenerEvolucion(db, r);
    expect(transaccion).toHaveBeenCalledTimes(1);
    expect(transaccion.mock.calls[0]![0]).toHaveLength(4);
    expect(transaccion.mock.calls[0]![1]).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
});
