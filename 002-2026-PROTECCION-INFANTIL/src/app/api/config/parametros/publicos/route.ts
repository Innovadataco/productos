import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCached, setCached } from "@/lib/config-cache";

export async function GET() {
    const cached = getCached<Record<string, unknown>>("public_params");
    if (cached) return NextResponse.json(cached);

    const params = await prisma.parametroSistema.findMany({
        where: { esPublico: true, esSecreto: false },
    });

    const result: Record<string, unknown> = {};
    for (const p of params) {
        result[p.clave] = {
            valor: parseValue(p.valor, p.tipo),
            tipo: p.tipo,
            descripcion: p.descripcion,
        };
    }

    setCached("public_params", result);
    return NextResponse.json(result);
}

function parseValue(valor: string, tipo: string): unknown {
    switch (tipo) {
        case "INTEGER":
            return parseInt(valor, 10);
        case "FLOAT":
            return parseFloat(valor);
        case "BOOLEAN":
            return valor === "true";
        case "JSON":
            return JSON.parse(valor);
        case "STRING_ARRAY":
            return JSON.parse(valor);
        default:
            return valor;
    }
}