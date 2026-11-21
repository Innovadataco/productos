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

export interface ResultadoPosiciones {
  readonly posiciones: Posicion[];
  /** Especies con ventas aprobadas sin asignar (VENTA_SIN_LOTES): quedan fuera hasta resolverse. */
  readonly especiesIncompletas: readonly string[];
}

async function especiesConVentasSinAsignar(db: PrismaClient): Promise<Set<string>> {
  const [vendido, asignado] = await Promise.all([
    db.orden.groupBy({ by: ["instrumentoId"], where: { lado: "VENTA", estado: "APROBADO" }, _sum: { cantidadCompletada: true } }),
    db.asignacionVenta.findMany({ select: { cantidad: true, ordenVenta: { select: { instrumentoId: true } } } }),
  ]);
  const porEspecie = new Map<string, bigint>();
  for (const a of asignado) porEspecie.set(a.ordenVenta.instrumentoId, (porEspecie.get(a.ordenVenta.instrumentoId) ?? 0n) + a.cantidad);
  return new Set(vendido.filter((v) => (v._sum.cantidadCompletada ?? 0n) > (porEspecie.get(v.instrumentoId) ?? 0n)).map((v) => v.instrumentoId));
}

/** Posiciones con cantidad > 0. Las especies con ventas sin asignar quedan fuera y se informan. */
export async function posiciones(db: PrismaClient): Promise<ResultadoPosiciones> {
  const incompletas = await especiesConVentasSinAsignar(db);
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
  const lista = [...porEspecie.entries()]
    .filter(([id, p]) => p.cantidad > 0n && !incompletas.has(id))
    .map(([instrumentoId, p]) => ({ instrumentoId, nemotecnico: p.nemotecnico, cantidad: p.cantidad, costoVivo: p.costo, lotesVivos: p.vivos }))
    .sort((a, b) => (a.nemotecnico ?? "").localeCompare(b.nemotecnico ?? ""));
  return { posiciones: lista, especiesIncompletas: [...incompletas] };
}
