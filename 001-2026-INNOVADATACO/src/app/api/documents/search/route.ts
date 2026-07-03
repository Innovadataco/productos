import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { DocumentoOficial } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Consulta requerida" }, { status: 400 });
    }

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const docs = await prisma.documentoOficial.findMany();

    const scored = (docs as DocumentoOficial[])
      .map((doc: DocumentoOficial) => {
        const text = `${doc.titulo} ${doc.contenidoTexto} ${doc.resumen} ${doc.proposito}`.toLowerCase();
        const score = terms.reduce((acc, term) => acc + (text.includes(term) ? 1 : 0), 0);
        return { ...doc, score };
      })
      .filter((d: { score: number }) => d.score > 0)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, 5);

    return NextResponse.json(scored);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error en búsqueda" }, { status: 500 });
  }
}
