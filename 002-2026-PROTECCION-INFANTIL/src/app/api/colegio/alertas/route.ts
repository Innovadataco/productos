import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { alertaQuerySchema, alertaBatchSchema } from "@/lib/schemas";
import { listarBandejaAlertasColegio, aplicarAccionEnLote } from "@/lib/colegio/alertas";

export async function GET(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_gestion");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        if (!user.colegioId) {
            return NextResponse.json({ alertas: [], total: 0, page: 1, pageSize: 25 });
        }

        const { searchParams } = new URL(request.url);
        const query = withValidation.params(alertaQuerySchema)({
            estado: searchParams.get("estado") ?? undefined,
            tipoSujeto: searchParams.get("tipoSujeto") ?? undefined,
            prioridad: searchParams.get("prioridad") ?? undefined,
            cursoId: searchParams.get("cursoId") ?? undefined,
            categoria: searchParams.get("categoria") ?? undefined,
            page: searchParams.get("page") ?? undefined,
            pageSize: searchParams.get("pageSize") ?? undefined,
        });

        const { page, pageSize, ...rest } = query;
        const filtros: Parameters<typeof listarBandejaAlertasColegio>[1] = {};
        if (rest.estado) filtros.estado = rest.estado;
        if (rest.tipoSujeto) filtros.tipoSujeto = rest.tipoSujeto;
        if (rest.prioridad) filtros.gravedad = rest.prioridad;
        if (rest.cursoId) filtros.cursoId = rest.cursoId;
        if (rest.categoria) filtros.categoria = rest.categoria;
        const resultado = await listarBandejaAlertasColegio(user.colegioId, filtros, { page, pageSize });

        return NextResponse.json(resultado);
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/ALERTAS]");
    }
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_gestion");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const body = await withValidation.body(alertaBatchSchema)(request);
        const payload: { asignadoAId?: string } = {};
        if (body.asignadoAId) payload.asignadoAId = body.asignadoAId;
        const resultado = await aplicarAccionEnLote(
            user.colegioId,
            body.ids,
            body.accion,
            user.id,
            payload,
            request
        );

        return NextResponse.json(resultado);
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/ALERTAS/BATCH]");
    }
}
