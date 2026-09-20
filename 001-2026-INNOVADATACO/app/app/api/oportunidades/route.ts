import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

export async function GET() {
  const oportunidades = await prisma.oportunidad.findMany({
    include: { cliente: true, responsable: true, proyecto: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(oportunidades);
}

export async function POST(request: Request) {
  const body = await request.json();

  if (body.fechaInicioPlaneada && body.fechaFinPlaneada) {
    const inicio = new Date(body.fechaInicioPlaneada);
    const fin = new Date(body.fechaFinPlaneada);
    if (fin < inicio) {
      return NextResponse.json(
        { error: "La fecha de fin no puede ser menor a la fecha de inicio." },
        { status: 400 }
      );
    }
  }

  const ultimas = await prisma.oportunidad.findMany({
    where: { codigo: { startsWith: "OPP-2026-" } },
    orderBy: { codigo: "desc" },
    take: 1,
  });

  let siguiente = 1;
  if (ultimas.length > 0) {
    const match = ultimas[0].codigo.match(/OPP-2026-(\d+)/);
    if (match) siguiente = Number(match[1]) + 1;
  }
  const codigo = `OPP-2026-${String(siguiente).padStart(3, "0")}`;

  const oportunidad = await prisma.oportunidad.create({
    data: {
      codigo,
      nombre: body.nombre,
      modalidad: body.modalidad,
      entidadContratante: body.entidadContratante,
      clienteId: body.clienteId || null,
      responsableId: body.responsableId || null,
      fechaInicioPlaneada: body.fechaInicioPlaneada ? new Date(body.fechaInicioPlaneada) : null,
      fechaFinPlaneada: body.fechaFinPlaneada ? new Date(body.fechaFinPlaneada) : null,
      valorEstimado: body.valorEstimado ? Number(body.valorEstimado) : null,
      alcance: body.alcance,
      estado: "ACTIVA",
    },
    include: { cliente: true, responsable: true },
  });

  return NextResponse.json(oportunidad, { status: 201 });
}
