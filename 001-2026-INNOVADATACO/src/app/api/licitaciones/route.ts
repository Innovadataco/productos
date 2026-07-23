import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/licitaciones - Listar todas las licitaciones
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const estado = searchParams.get("estado");
    const entidad = searchParams.get("entidad");
    const busqueda = searchParams.get("q");

    const where: any = {};

    if (estado) {
      where.estado = { key: estado };
    }

    if (entidad) {
      where.entidadId = parseInt(entidad);
    }

    if (busqueda) {
      where.OR = [
        { numero: { contains: busqueda, mode: "insensitive" } },
        { titulo: { contains: busqueda, mode: "insensitive" } },
        { descripcion: { contains: busqueda, mode: "insensitive" } },
      ];
    }

    const licitaciones = await prisma.licitacion.findMany({
      where,
      include: {
        estado: true,
        entidad: true,
        documentos: {
          select: {
            id: true,
            nombre: true,
            tipo: true,
            fechaInicio: true,
            fechaFin: true,
          },
        },
      },
      orderBy: { fechaApertura: "desc" },
    });

    return NextResponse.json(licitaciones);
  } catch (error: unknown) {
    return apiError("Licitaciones", "GET lista", "Error al obtener licitaciones", 500, error);
  }
}

// POST /api/licitaciones - Crear nueva licitación
export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth();
    if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const data = await req.json();
    const {
      numero,
      titulo,
      descripcion,
      estadoId,
      entidadId,
      areaIdSala,
      fechaApertura,
      documentoUrl,
    } = data;

    // Validaciones
    if (!numero || !titulo || !estadoId || !fechaApertura) {
      return NextResponse.json(
        { error: "Número, título, estado y fecha de apertura son requeridos" },
        { status: 400 }
      );
    }

    const licitacion = await prisma.licitacion.create({
      data: {
        numero,
        titulo,
        descripcion: descripcion || "",
        estadoId: parseInt(estadoId),
        entidadId: entidadId ? parseInt(entidadId) : null,
        areaIdSala: areaIdSala ? parseInt(areaIdSala) : null,
        fechaApertura: new Date(fechaApertura),
        documentoUrl: documentoUrl || null,
      },
      include: {
        estado: true,
        entidad: true,
      },
    });

    return NextResponse.json(licitacion, { status: 201 });
  } catch (error) {
    console.error("Error al crear licitación:", error);
    return NextResponse.json(
      { error: "Error al crear licitación" },
      { status: 500 }
    );
  }
}
