/**
 * Clase del fondo (`tipo_participacion` de la SFC) guardada en `SimboloPrecio` con proveedor
 * `sfc:qhpu-8ixx`, con vigencia: la misma tabla de equivalencias que usan los precios.
 */
import type { PrismaClient } from "@prisma/client";
import { FUENTE_SFC } from "./sfc";

/** Lo único que hace falta de la base (sirve el cliente o una transacción). */
export type ConSimbolos = Pick<PrismaClient, "simboloPrecio">;

/** Clase vigente del fondo en la fecha, o null si no tiene una registrada. */
export async function claseVigente(db: ConSimbolos, instrumentoId: string, fecha: Date): Promise<string | null> {
  const clase = await db.simboloPrecio.findFirst({
    where: { instrumentoId, proveedor: FUENTE_SFC, vigenteDesde: { lte: fecha }, OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: fecha } }] },
    select: { simbolo: true },
  });
  return clase?.simbolo ?? null;
}
