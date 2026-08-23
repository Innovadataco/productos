import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { GuiaAccionService } from "@/lib/dal/services/guia-accion";
import { guiaAccionEditarBodySchema, guiaAccionIdParamsSchema } from "@/lib/schemas/guia-accion";
import type { Prisma } from "@prisma/client";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "guias_accion_admin");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const params = await context.params;
        const paramsParsed = guiaAccionIdParamsSchema.safeParse(params);
        if (!paramsParsed.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR, details: paramsParsed.error.format() } },
                { status: 400 }
            );
        }

        const body = await request.json();
        const parsed = guiaAccionEditarBodySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const raw = parsed.data;
        const input: {
            tituloEmocional?: string;
            subtitulo?: string | null;
            categoriaBadgeTexto?: string;
            pasosJson?: Prisma.InputJsonValue;
            calloutTitulo?: string | null;
            calloutTexto?: string | null;
            botonesAccionJson?: Prisma.InputJsonValue;
            piePagina?: string | null;
        } = {};
        if (raw.tituloEmocional !== undefined) input.tituloEmocional = raw.tituloEmocional;
        if (raw.subtitulo !== undefined) input.subtitulo = raw.subtitulo ?? null;
        if (raw.categoriaBadgeTexto !== undefined) input.categoriaBadgeTexto = raw.categoriaBadgeTexto;
        if (raw.pasosJson !== undefined) input.pasosJson = raw.pasosJson;
        if (raw.calloutTitulo !== undefined) input.calloutTitulo = raw.calloutTitulo ?? null;
        if (raw.calloutTexto !== undefined) input.calloutTexto = raw.calloutTexto ?? null;
        if (raw.botonesAccionJson !== undefined) input.botonesAccionJson = raw.botonesAccionJson;
        if (raw.piePagina !== undefined) input.piePagina = raw.piePagina ?? null;

        const guia = await new GuiaAccionService().editar(paramsParsed.data.id, input, admin.id);
        return NextResponse.json({ guia });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/GUIAS-ACCION/EDITAR]");
    }
}
