import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET() {
    try {
        const proyectos = await prisma.proyecto.findMany({
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(proyectos);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Error listando proyectos" }, { status: 500 });
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
    } catch (err: any) {
        console.error(err);
        if (err.code === "P2002") {
            return NextResponse.json({ error: "Ya existe un proyecto con ese código" }, { status: 409 });
        }
        return NextResponse.json({ error: err.message || "Error creando proyecto" }, { status: 500 });
    }
}