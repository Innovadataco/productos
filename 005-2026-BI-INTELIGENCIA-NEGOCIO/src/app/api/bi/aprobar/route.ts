import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { vectorizar } from "@/lib/bi/embedding";
import { guardarAprobacion } from "@/lib/bi/cache-semantico";

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
    const { consultaLogId } = body as { consultaLogId?: string };
    if (typeof consultaLogId !== "string" || !consultaLogId) {
        return NextResponse.json({ error: "consultaLogId_requerido" }, { status: 400 });
    }
    const log = await prisma.bIConsultaLog.findUnique({ where: { id: consultaLogId } });
    if (!log) {
        return NextResponse.json({ error: "consulta_no_encontrada" }, { status: 404 });
    }
    if (!log.sqlGenerado) {
        return NextResponse.json({ error: "consulta_sin_sql" }, { status: 400 });
    }
    const emb = await vectorizar(log.preguntaNL);
    if (!emb) {
        return NextResponse.json({ error: "embedding_no_disponible" }, { status: 503 });
    }
    await guardarAprobacion(prisma, {
        preguntaNL: log.preguntaNL,
        sql: log.sqlGenerado,
        aprobadoPor: usuario.id,
        embedding: emb,
        consultaLogId,
    });
    return NextResponse.json({ ok: true });
}
