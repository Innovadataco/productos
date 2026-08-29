import { NextResponse } from "next/server";
import { PlataformaRepository } from "@/lib/dal/repositories/plataforma";

export async function GET() {
    // E-8: la consulta vive en el repo; la ruta no toca prisma.
    const plataformas = await new PlataformaRepository().listarActivasConCategoria();

    // "otro" siempre al final
    const ordenadas = [
        ...plataformas.filter((p) => p.clave !== "otro"),
        ...plataformas.filter((p) => p.clave === "otro"),
    ];

    return NextResponse.json({ plataformas: ordenadas });
}