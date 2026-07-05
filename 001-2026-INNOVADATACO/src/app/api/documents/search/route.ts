import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { DocumentoOficial } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, tipo, entidad, sector, fechaDesde, fechaHasta } = body;
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Consulta requerida" }, { status: 400 });
    }

    const where: any = { activo: true };
    if (tipo) where.tipo = tipo;
    if (entidad) where.entidad = entidad;
    if (sector) where.sector = sector;
    if (fechaDesde || fechaHasta) {
      where.fechaExpedicion = {};
      if (fechaDesde) where.fechaExpedicion.gte = new Date(fechaDesde);
      if (fechaHasta) where.fechaExpedicion.lte = new Date(fechaHasta);
    }

    const docs = await prisma.documentoOficial.findMany({ where });

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = (docs as DocumentoOficial[])
      .map((doc: DocumentoOficial) => {
        const text = `${doc.titulo} ${doc.contenidoTexto} ${doc.resumen} ${doc.proposito}`.toLowerCase();
        const score = terms.reduce((acc, term) => acc + (text.includes(term) ? 1 : 0), 0);
        return { ...doc, score };
      })
      .filter((d: { score: number }) => d.score > 0)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, 20);

    return NextResponse.json(scored);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error en búsqueda" }, { status: 500 });
  }
}
