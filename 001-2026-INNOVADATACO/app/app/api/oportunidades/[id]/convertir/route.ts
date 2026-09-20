import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: Record<string, string | undefined> = {};
  try {
    const raw = await request.json();
    body = typeof raw === "object" && raw !== null ? (raw as Record<string, string | undefined>) : {};
  } catch {
    body = {};
  }

  const oportunidad = await prisma.oportunidad.findUnique({
    where: { id },
    include: { cliente: true },
  });

  if (!oportunidad) {
    return NextResponse.json({ error: "Oportunidad no encontrada" }, { status: 404 });
  }

  if (oportunidad.estado !== "ADJUDICADA" && oportunidad.estado !== "PRESENTADA") {
    return NextResponse.json(
      { error: "Solo se pueden convertir oportunidades adjudicadas o presentadas" },
      { status: 400 }
    );
  }

  const ultimos = await prisma.proyecto.findMany({
    where: { codigo: { startsWith: "IDC-2026-" } },
    orderBy: { codigo: "desc" },
    take: 1,
  });
  let siguiente = 1;
  if (ultimos.length > 0) {
    const match = ultimos[0].codigo.match(/IDC-2026-(\d+)/);
    if (match) siguiente = Number(match[1]) + 1;
  }
  const codigo = `IDC-2026-${String(siguiente).padStart(3, "0")}`;

  const clienteId = oportunidad.clienteId || body.clienteId;
  if (!clienteId) {
    return NextResponse.json(
      { error: "La oportunidad no tiene cliente asignado" },
      { status: 400 }
    );
  }

  const proyecto = await prisma.proyecto.create({
    data: {
      codigo,
      nombre: oportunidad.nombre,
      oportunidadId: oportunidad.id,
      clienteId,
      responsableId: body.responsableId || oportunidad.responsableId,
      fechaInicioReal: body.fechaInicioReal ? new Date(body.fechaInicioReal) : new Date(),
      fechaEntregaPlaneada: oportunidad.fechaFinPlaneada,
      valorContratado: oportunidad.valorEstimado,
      alcance: oportunidad.alcance,
      estado: "PLANIFICACION",
    },
  });

  await prisma.oportunidad.update({
    where: { id },
    data: { estado: "ADJUDICADA" },
  });

  return NextResponse.json(proyecto, { status: 201 });
}
