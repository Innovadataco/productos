import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { GuiaAccionService } from "@/lib/dal/services/guia-accion";
import { GuiaAccionRepository } from "@/lib/dal/repositories/guia-accion-repository";
import { EstadoGuiaAccion } from "@prisma/client";
import { z } from "zod";
import {
    guiaAccionCrearBodySchema,
} from "@/lib/schemas/guia-accion";

const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    estado: z.enum(["BORRADOR", "PENDIENTE_APROBACION_COMITE", "ACTIVA", "REEMPLAZADA"]).optional(),
    categoria: z.string().max(100).optional(),
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
        await assertModulo(admin, "guias_accion_admin");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const url = new URL(request.url);
        const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "Parámetros inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsedQuery.error.format() } },
                { status: 400 }
            );
        }

        const { page, pageSize, estado, categoria } = parsedQuery.data;
        const resultado = await new GuiaAccionService().listar({
            page,
            pageSize,
            ...(estado ? { estado } : {}),
            ...(categoria ? { categoria } : {}),
        });

        return NextResponse.json(resultado);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/GUIAS-ACCION]");
    }
}

export async function POST(request: Request) {
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

        const body = await request.json();
        const parsed = guiaAccionCrearBodySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const {
            categoria,
            tituloEmocional,
            subtitulo,
            categoriaBadgeTexto,
            pasosJson,
            calloutTitulo,
            calloutTexto,
            botonesAccionJson,
            piePagina,
        } = parsed.data;

        const repo = new GuiaAccionRepository();
        const ultima = await repo.buscarUltimaVersionPorCategoria(categoria);
        const versionSecuencial = (ultima?.versionSecuencial ?? 0) + 1;

        const service = new GuiaAccionService();
        const guia = await service.crear({
            categoria,
            versionSecuencial,
            tituloEmocional,
            subtitulo: subtitulo ?? null,
            categoriaBadgeTexto,
            pasosJson,
            calloutTitulo: calloutTitulo ?? null,
            calloutTexto: calloutTexto ?? null,
            botonesAccionJson,
            piePagina: piePagina ?? null,
            estado: EstadoGuiaAccion.BORRADOR,
            aprobadaPorComiteJson: [],
            creadaPorAdminId: admin.id,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "GUIA_ACCION_CREADA",
            tipoRecurso: "GuiaAccionCategoria",
            recursoId: guia.id,
            usuarioId: admin.id,
            valorNuevo: JSON.stringify({ categoria, versionSecuencial, estado: guia.estado }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ guia }, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/GUIAS-ACCION]");
    }
}
