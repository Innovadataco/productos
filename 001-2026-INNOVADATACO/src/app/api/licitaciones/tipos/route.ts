import { NextRequest, NextResponse } from "next/server";
import { apiError, noAutenticado, esCodigoPrisma } from "@/lib/apiError";
import { verifyAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/licitaciones/tipos - Listar los tipos de oportunidad (catálogo configurable)
export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const tipos = await prisma.tipoOportunidad.findMany({
      orderBy: { id: "asc" },
    });

    return NextResponse.json(tipos);
  } catch (error: unknown) {
    return apiError("Oportunidades", "GET tipos", "Error al obtener tipos", 500, error);
  }
}

// POST /api/licitaciones/tipos - Crear un tipo de oportunidad
export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const data = await req.json();
    const { key, nombreOficial, exigeNumero, exigeFechaApertura } = data;

    if (!key || !nombreOficial) {
      return NextResponse.json(
        { error: "Key y nombre oficial son requeridos" },
        { status: 400 }
      );
    }

    const tipo = await prisma.tipoOportunidad.create({
      data: {
        key,
        nombreOficial,
        // Banderas de obligatoriedad por tipo (§0.7): la validación las lee, no
        // hay nombres de tipo cableados en el código.
        exigeNumero: Boolean(exigeNumero),
        exigeFechaApertura: Boolean(exigeFechaApertura),
      },
    });

    return NextResponse.json(tipo, { status: 201 });
  } catch (error: unknown) {
    if (esCodigoPrisma(error, "P2002")) {
      return NextResponse.json({ error: "Ya existe un tipo con esa clave" }, { status: 409 });
    }
    return apiError("Oportunidades", "POST tipo", "Error al crear tipo", 500, error);
  }
}
