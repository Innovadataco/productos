import { NextRequest, NextResponse } from "next/server";
import { apiError, noAutenticado } from "@/lib/apiError";
import { auditLog } from "@/lib/audit";
import { verifyAuth } from "@/lib/auth";
import { datosEntregable, validarEntregable } from "@/lib/entregable";
import { prisma } from "@/lib/prisma";

/**
 * Entregables de un proyecto (spec 008, US3 / FR-009).
 *
 * Colgados del proyecto por ruta (`/api/projects/[id]/entregables`) igual que el
 * expediente cuelga de la oportunidad: el recurso no existe fuera de su padre.
 */

// GET /api/projects/[id]/entregables — listar
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { id } = await params;

    const proyecto = await prisma.proyecto.findUnique({ where: { id } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const entregables = await prisma.entregable.findMany({
      where: { proyectoId: id },
      orderBy: [{ fechaCompromiso: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(entregables);
  } catch (err: unknown) {
    return apiError("Proyectos", "GET entregables", "Error listando entregables", 500, err);
  }
}

// POST /api/projects/[id]/entregables — crear
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { id } = await params;
    const body = await req.json();

    const proyecto = await prisma.proyecto.findUnique({ where: { id } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const problema = validarEntregable(body);
    if (problema) return NextResponse.json({ error: problema }, { status: 400 });

    const entregable = await prisma.entregable.create({
      data: { ...datosEntregable(body), proyectoId: id },
    });

    await auditLog({
      action: "proyecto.entregable.creado",
      entityType: "Entregable",
      entityId: entregable.id,
      userId: session.sub,
      status: "success",
      message: `Entregable "${entregable.nombre}" en ${proyecto.codigo}`,
      metadata: { proyectoId: id },
    });

    return NextResponse.json(entregable, { status: 201 });
  } catch (err: unknown) {
    return apiError("Proyectos", "POST entregable", "Error creando entregable", 500, err);
  }
}
