import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function extraerUsuario(req: Request): { id: string; rol: string } {
    return {
        id: req.headers.get("x-user-id") || "dev-local",
        rol: req.headers.get("x-user-rol") || "GUEST",
    };
}

export async function POST(req: Request) {
    const usuario = extraerUsuario(req);
    if (usuario.rol !== "ADMIN") {
        return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
    }
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "json_invalido" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "body_invalido" }, { status: 400 });
    }
    const { consultaLogId, razon } = body as { consultaLogId?: string; razon?: string };
    if (typeof consultaLogId !== "string" || !consultaLogId) {
        return NextResponse.json({ error: "consultaLogId_requerido" }, { status: 400 });
    }
    const log = await prisma.bIConsultaLog.findUnique({ where: { id: consultaLogId } });
    if (!log) {
        return NextResponse.json({ error: "consulta_no_encontrada" }, { status: 404 });
    }
    await prisma.bIConsultaLog.update({
        where: { id: consultaLogId },
        data: {
            estado: "REVISION_HUMANA",
            error: (typeof razon === "string" && razon) || "sin_razon",
        },
    });
    return NextResponse.json({ ok: true });
}
