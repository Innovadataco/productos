import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { preguntar } from "@/lib/bi/motor";
import { sesionDeRequest } from "@/lib/auth/sesion";
import type { Rol } from "@/lib/bi/tipos";

const ROLES_VALIDOS: Rol[] = ["ADMIN", "SCHOOL_ADMIN", "PARENT"];

function validarBody(raw: unknown): { ok: true; body: { preguntaNL: string; rol: Rol; usuarioId: string; tenantId?: string } } | { ok: false; error: string } {
    if (!raw || typeof raw !== "object") return { ok: false, error: "body_no_objeto" };
    const b = raw as Record<string, unknown>;
    if (typeof b.preguntaNL !== "string" || b.preguntaNL.trim().length === 0) {
        return { ok: false, error: "preguntaNL_requerida" };
    }
    const rolRaw = typeof b.rol === "string" ? b.rol : "ADMIN";
    if (!ROLES_VALIDOS.includes(rolRaw as Rol)) {
        return { ok: false, error: "rol_invalido" };
    }
    const usuarioId = typeof b.usuarioId === "string" && b.usuarioId.length > 0 ? b.usuarioId : "dev-local";
    const tenantId = typeof b.tenantId === "string" ? b.tenantId : undefined;
    return {
        ok: true,
        body: { preguntaNL: b.preguntaNL, rol: rolRaw as Rol, usuarioId, tenantId },
    };
}

export async function POST(req: Request) {
    // SPEC-035 · guard de sesión ANTES de tocar body o motor (I-33): un POST
    // anónimo disparaba el jurado de 3 modelos (~76s de Ollama en el Mac
    // Studio · DoS trivial contra el mismo motor que usa PI en prod). El 401
    // corta acá sin invocar ningún modelo.
    const sesion = await sesionDeRequest(req);
    if (!sesion) {
        return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
    }

    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return NextResponse.json({ error: "json_invalido" }, { status: 400 });
    }
    const parsed = validarBody(raw);
    if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { preguntaNL, rol, usuarioId, tenantId } = parsed.body;
    try {
        const resultado = await preguntar(
            { preguntaNL, usuario: { id: usuarioId, rol, tenantId } },
            { prisma },
        );
        const status = resultado.estado === "OK" ? 200 : resultado.estado === "REVISION" ? 202 : 400;
        return NextResponse.json(resultado, { status });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "motor_error";
        return NextResponse.json({ error: "motor_error", detalle: msg }, { status: 500 });
    }
}
