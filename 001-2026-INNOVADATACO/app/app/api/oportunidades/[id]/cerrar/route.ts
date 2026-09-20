import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const oportunidad = await prisma.oportunidad.findUnique({ where: { id } });

  if (!oportunidad) {
    return NextResponse.json({ error: "Oportunidad no encontrada" }, { status: 404 });
  }

  const estado = body.adjudicada === true ? "ADJUDICADA" : "NO_ADJUDICADA";

  const actualizada = await prisma.oportunidad.update({
    where: { id },
    data: {
      estado,
      motivoCierre: body.motivoCierre || null,
      comentarioCierre: body.comentarioCierre || null,
    },
  });

  return NextResponse.json(actualizada);
}
