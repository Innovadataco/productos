/**
 * La conciliación lee varias tablas: debe hacerlo con una instantánea consistente (REPEATABLE READ), para que una
 * importación que confirma en medio no deje una conciliación guardada mezclada (code-reviewer y database-reviewer).
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { conciliarCertificacion } from "@/conciliacion/conciliar";

describe("conciliarCertificacion: aislamiento", () => {
  it("abre la transacción en REPEATABLE READ", async () => {
    let opciones: unknown = null;
    const falso = {
      $transaction: async (_fn: unknown, o: unknown) => {
        opciones = o;
        throw new Error("corte de la prueba");
      },
    } as unknown as PrismaClient;
    await expect(conciliarCertificacion(falso, { fechaCorte: new Date("2024-01-04T00:00:00Z") })).rejects.toThrow("corte de la prueba");
    expect(opciones).toMatchObject({ isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
});
