/**
 * SPEC-320 (§2.3): catálogo único de tipos de documento — CRUD del ADMIN de plataforma.
 * GET lista el catálogo completo; POST crea un tipo nuevo. Fuente única de vocabulario
 * para los tres sujetos (estudiante, profesor, comité).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { TipoDocumentoRepository } from "@/lib/dal/repositories/tipo-documento";

const crearSchema = z.object({
    clave: z.string().min(1).max(20).transform((s) => s.trim().toUpperCase()),
    nombre: z.string().min(1).max(100),
    categoria: z.string().min(1).max(50).optional(),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const items = await new TipoDocumentoRepository().listar();
        return NextResponse.json({ items });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/TIPOS-DOCUMENTO]");
    }
}

export async function POST(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const parsed = crearSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }
        const tipo = await new TipoDocumentoRepository().crear(parsed.data);
        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "ADMIN_TIPO_DOCUMENTO_CREADO",
            tipoRecurso: "TipoDocumento",
            recursoId: tipo.id,
            usuarioId: admin.id,
            valorNuevo: JSON.stringify({ clave: tipo.clave, nombre: tipo.nombre, categoria: tipo.categoria }),
            ipAddress,
            userAgent,
        });
        return NextResponse.json({ tipo }, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/TIPOS-DOCUMENTO]");
    }
}
