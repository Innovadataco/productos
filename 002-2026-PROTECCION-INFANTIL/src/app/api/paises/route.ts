import { NextResponse } from "next/server";
import { PaisRepository } from "@/lib/dal/repositories/pais";

export async function GET() {
    // E-8: la consulta vive en el repo; la ruta no toca prisma.
    const paises = await new PaisRepository().listarActivos();

    return NextResponse.json({ paises });
}