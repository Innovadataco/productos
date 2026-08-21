import { NextResponse } from "next/server";
import { z } from "zod";
import { EstadoReporte } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { OperadorMetricasService } from "@/lib/dal/services/operador-metricas";

const querySchema = z.object({
    estado: z.nativeEnum(EstadoReporte).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "operadores");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const { id } = await params;

        const { searchParams } = new URL(request.url);
        const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Parámetros inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const { estado, page, pageSize } = parsed.data;
        const filtros = estado ? { estado } : {};
        const [items, total] = await new OperadorMetricasService().listarCasos(id, filtros, { page, pageSize });

        const totalPages = Math.ceil(total / pageSize);
        return NextResponse.json({
            items,
            pagination: { page, pageSize, total, totalPages },
        });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/OPERADORES/CASOS]");
    }
}
