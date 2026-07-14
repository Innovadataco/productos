import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const paises = await prisma.pais.findMany({
        where: { esActivo: true },
        orderBy: { nombre: "asc" },
        select: { id: true, codigo: true, nombre: true },
    });

    return NextResponse.json({ paises });
}