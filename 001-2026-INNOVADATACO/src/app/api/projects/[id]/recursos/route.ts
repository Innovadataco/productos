import { NextRequest, NextResponse } from "next/server";
import { apiError, noAutenticado } from "@/lib/apiError";
import { auditLog } from "@/lib/audit";
import { verifyAuth } from "@/lib/auth";
import { validarRecurso, datosRecurso } from "@/lib/proyectoPm2";
import { prisma } from "@/lib/prisma";

/**
 * Recursos del proyecto (spec 008, US5 / FR-013).
 *
 * Cuelga de la ruta del proyecto, igual que los entregables: el recurso no
 * existe sin su padre y la ruta lo dice.
 */

// GET /api/projects/[id]/recursos
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

    const items = await prisma.recursoProyecto.findMany({
      where: { proyectoId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(items);
  } catch (err: unknown) {
    return apiError("Proyectos", "GET recursos", "Error listando recursos del proyecto", 500, err);
  }
}

// POST /api/projects/[id]/recursos
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

    const problema = validarRecurso(body);
    if (problema) return NextResponse.json({ error: problema }, { status: 400 });

    const creado = await prisma.recursoProyecto.create({
      data: { ...datosRecurso(body), proyectoId: id },
    });

    await auditLog({
      action: "proyecto.recurso.creado",
      entityType: "Recurso",
      entityId: creado.id,
      userId: session.sub,
      status: "success",
      message: `Recurso en ${proyecto.codigo}`,
      metadata: { proyectoId: id },
    });

    return NextResponse.json(creado, { status: 201 });
  } catch (err: unknown) {
    return apiError("Proyectos", "POST recurso", "Error creando recurso", 500, err);
  }
}
