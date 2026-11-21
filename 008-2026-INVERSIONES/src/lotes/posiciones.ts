/** Posición viva por especie (INV-SPEC-12): lo comprado o recibido menos lo vendido, y su costo. */
import { Prisma, type PrismaClient } from "@prisma/client";

export interface Posicion {
  readonly instrumentoId: string;
  readonly nemotecnico: string | null;
  readonly cantidad: bigint;
  /** Costo de lo que queda (sin comisiones), según el lote: Trii o el portal de A&V. */
  readonly costoVivo: Prisma.Decimal;
  readonly lotesVivos: number;
}

/** Posiciones con cantidad > 0. Las especies con ventas sin lote quedan fuera hasta resolverse. */
export async function posiciones(db: PrismaClient): Promise<Posicion[]> {
  const lotes = await db.lote.findMany({
    select: { id: true, instrumentoId: true, cantidad: true, costoTotal: true, instrumento: { select: { nemotecnico: true } }, asignaciones: { select: { cantidad: true, costoBase: true } } },
  });
  const porEspecie = new Map<string, { nemotecnico: string | null; cantidad: bigint; costo: Prisma.Decimal; vivos: number }>();
  for (const l of lotes) {
    const vendida = l.asignaciones.reduce((s, a) => s + a.cantidad, 0n);
    const costoVendido = l.asignaciones.reduce((s, a) => s.add(a.costoBase), new Prisma.Decimal(0));
    const queda = l.cantidad - vendida;
    const actual = porEspecie.get(l.instrumentoId) ?? { nemotecnico: l.instrumento.nemotecnico, cantidad: 0n, costo: new Prisma.Decimal(0), vivos: 0 };
    porEspecie.set(l.instrumentoId, {
      ...actual,
      cantidad: actual.cantidad + queda,
      costo: actual.costo.add(l.costoTotal.sub(costoVendido)),
      vivos: actual.vivos + (queda > 0n ? 1 : 0),
    });
  }
  return [...porEspecie.entries()]
    .filter(([, p]) => p.cantidad > 0n)
    .map(([instrumentoId, p]) => ({ instrumentoId, nemotecnico: p.nemotecnico, cantidad: p.cantidad, costoVivo: p.costo, lotesVivos: p.vivos }))
    .sort((a, b) => (a.nemotecnico ?? "").localeCompare(b.nemotecnico ?? ""));
}
