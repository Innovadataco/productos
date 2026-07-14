import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const plataformas = await prisma.plataforma.findMany({
        where: { esActiva: true },
        orderBy: { nombre: "asc" },
        select: { id: true, clave: true, nombre: true, categoria: true },
    });

    // "otro" siempre al final
    const ordenadas = [
        ...plataformas.filter((p) => p.clave !== "otro"),
        ...plataformas.filter((p) => p.clave === "otro"),
    ];

    return NextResponse.json({ plataformas: ordenadas });
}