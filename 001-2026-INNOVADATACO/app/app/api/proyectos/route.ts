import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

export async function GET() {
  const proyectos = await prisma.proyecto.findMany({
    include: { cliente: true, responsable: true, oportunidad: true, hitos: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(proyectos);
}

export async function POST(request: Request) {
  const body = await request.json();

  const count = await prisma.proyecto.count();
  const codigo = `IDC-2026-${String(count + 1).padStart(3, "0")}`;

  const proyecto = await prisma.proyecto.create({
    data: {
      codigo,
      nombre: body.nombre,
      clienteId: body.clienteId,
      responsableId: body.responsableId || null,
      fechaInicioReal: body.fechaInicioReal ? new Date(body.fechaInicioReal) : null,
      fechaEntregaPlaneada: body.fechaEntregaPlaneada ? new Date(body.fechaEntregaPlaneada) : null,
      valorContratado: body.valorContratado ? Number(body.valorContratado) : null,
      alcance: body.alcance,
      estado: body.estado || "PLANIFICACION",
    },
    include: { cliente: true, responsable: true },
  });

  return NextResponse.json(proyecto, { status: 201 });
}
