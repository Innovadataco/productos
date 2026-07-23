import { NextRequest, NextResponse } from "next/server";
import { apiError, esCodigoPrisma } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET() {
    try {
        const session = await verifyAuth();
        if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

        const proyectos = await prisma.proyecto.findMany({
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(proyectos);
    } catch (err: unknown) {
        return apiError("Proyectos", "GET lista", "Error listando proyectos", 500, err);
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await verifyAuth();
        if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

        const body = await req.json();
        const { codigo, nombre, cliente, estado, currentPhase } = body;

        if (!codigo || !nombre) {
            return NextResponse.json({ error: "Campos requeridos: codigo, nombre" }, { status: 400 });
        }

        const proyecto = await prisma.proyecto.create({
            data: {
                codigo,
                nombre,
                cliente: cliente || "",
                estado: estado || "active",
                currentPhase: currentPhase || "initiation",
            },
        });

        return NextResponse.json(proyecto, { status: 201 });
    } catch (err: unknown) {
        if (esCodigoPrisma(err, "P2002")) {
            return apiError("Proyectos", "POST proyecto", "Ya existe un proyecto con ese código", 409, err);
        }
        return apiError("Proyectos", "POST proyecto", "Error creando proyecto", 500, err);
    }
}