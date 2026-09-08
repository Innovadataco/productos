/**
 * SPEC-590 (decisión CEO 06-09) — «Historial de cambios» de «Mi perfil».
 *
 * Devuelve los PERFIL_CAMBIO del PROPIO usuario, paginados y del más reciente
 * al más viejo. El scope es SIEMPRE el usuario de la sesión: este endpoint
 * NUNCA acepta un usuarioId por query — el historial es solo del titular.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { AuditLogRepository } from "@/lib/dal/repositories/audit-log";
import { ETIQUETAS_CAMPO_PERFIL } from "@/lib/padre/perfil-cambios";

const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

interface FilaCambio {
    campo: string | null;
    valor: string | null;
}

function leerCampoValor(json: string | null): FilaCambio {
    if (!json) return { campo: null, valor: null };
    try {
        const d = JSON.parse(json) as Record<string, unknown>;
        return { campo: typeof d.campo === "string" ? d.campo : null, valor: d.valor === null || d.valor === undefined ? null : String(d.valor) };
    } catch {
        return { campo: null, valor: null };
    }
}

export async function GET(request: Request) {
    try {
        const user = await verifyAuth("PARENT");
        const url = new URL(request.url);
        const parsed = querySchema.safeParse({
            page: url.searchParams.get("page") ?? undefined,
            pageSize: url.searchParams.get("pageSize") ?? undefined,
        });
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de paginación inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { page, pageSize } = parsed.data;
        // Scope SIEMPRE el usuario de la sesión: la query no acepta usuarioId
        // — el historial es solo del titular (ver doc del repositorio).
        const [filas, total] = await new AuditLogRepository().cambiosPerfilPaginados(user.id, {
            skip: (page - 1) * pageSize,
            take: pageSize,
        });
        const items = filas.map((f) => {
            const anterior = leerCampoValor(f.valorAnterior);
            const nuevo = leerCampoValor(f.valorNuevo);
            const campo = nuevo.campo ?? anterior.campo ?? "";
            return {
                id: f.id,
                campo,
                etiqueta: ETIQUETAS_CAMPO_PERFIL[campo] ?? campo,
                anterior: anterior.valor,
                nuevo: nuevo.valor,
                creadoEn: f.creadoEn,
            };
        });
        return NextResponse.json({
            items,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return errorToResponse(error, "[PADRE/PERFIL/AUDITORIA/GET]");
    }
}
