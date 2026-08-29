import { NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/config-cache";
import { ConfiguracionService } from "@/lib/dal/services/configuracion";

export async function GET() {
    const cached = getCached<Record<string, unknown>>("public_params");
    if (cached) return NextResponse.json(cached);

    // SPEC-053: la lectura y el parseo por tipo viven en el DAL; la ruta no toca prisma.
    const result = await new ConfiguracionService().publicos();

    setCached("public_params", result);
    return NextResponse.json(result);
}
