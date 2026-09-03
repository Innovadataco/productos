/**
 * SPEC-380 (PR B · C4/D-100) — GET/POST /api/colegio/comite/integrantes/[id]/identificadores.
 *
 * Alta y listado de identificadores del integrante del comité. Mismo patrón
 * que profesores/estudiantes/acudientes; el tenant lo resuelve la cuenta del
 * SCHOOL_ADMIN o COMITE_CONVIVENCIA (ver `resolverColegioId` abajo).
 *
 * Privacidad (CANDADO CEO): el aviso va al COLEGIO — jamás a la persona
 * vigilada. El propio `notificarColegioSiCorresponde` ya crea la alerta
 * colegio-scoped; este endpoint solo gestiona el catálogo.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { withValidation } from "@/lib/validation";
import { cuidIdSchema } from "@/lib/schemas";
import { IdentificadorIntegranteComiteRepository } from "@/lib/dal/repositories/identificador-integrante-comite";
import { normalizarIdentificador, inferirTipoIdentificador } from "@/lib/colegio/normalizacion";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({
    tipo: z.string().trim().max(50).optional(),
    valor: z.string().trim().min(1, "Escriba el identificador.").max(200),
    plataformaId: z.string().trim().optional().nullable(),
});

async function resolverColegioId(user: { rol: string; colegioId?: string | null; comiteColegioId?: string | null }): Promise<string | null> {
    if (user.rol === "SCHOOL_ADMIN") return user.colegioId ?? null;
    if (user.rol === "COMITE_CONVIVENCIA") return user.comiteColegioId ?? null;
    return null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        const colegioId = await resolverColegioId(user);
        if (!colegioId) {
            return NextResponse.json(
                { error: { message: "Cuenta sin colegio vinculado.", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }
        const { id } = withValidation.params(z.object({ id: cuidIdSchema }))(await params);
        const items = await new IdentificadorIntegranteComiteRepository().listarPorIntegrante(colegioId, id);
        return NextResponse.json({ items });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/COMITE/INTEGRANTES/IDENTIFICADORES/GET]");
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        const colegioId = await resolverColegioId(user);
        if (!colegioId) {
            return NextResponse.json(
                { error: { message: "Cuenta sin colegio vinculado.", code: ERROR_CODES.FORBIDDEN } },
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

        const { id } = withValidation.params(z.object({ id: cuidIdSchema }))(await params);
        const body = await withValidation.body(bodySchema)(request);
        const valor = normalizarIdentificador(body.valor);
        const tipo = (body.tipo && body.tipo.trim()) || inferirTipoIdentificador(valor);

        const repo = new IdentificadorIntegranteComiteRepository();
        const duplicado = await repo.buscarDuplicado(colegioId, {
            integranteId: id,
            tipo,
            valor,
            plataformaId: body.plataformaId ?? null,
        });
        if (duplicado) {
            return NextResponse.json(
                { error: { message: "Este identificador ya está registrado para el integrante.", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const creado = await repo.crear(colegioId, {
            integranteId: id,
            tipo,
            valor,
            plataformaId: body.plataformaId ?? null,
        });

        const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
        const userAgent = request.headers.get("user-agent") || "unknown";
        await logAudit({
            accion: "COLEGIO_ALERTA_CREADA",
            tipoRecurso: "IdentificadorIntegranteComite",
            recursoId: creado.id,
            usuarioId: user.id,
            colegioId,
            valorNuevo: JSON.stringify({ integranteId: id, tipo, plataformaId: body.plataformaId ?? null }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ identificador: creado }, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/COMITE/INTEGRANTES/IDENTIFICADORES/POST]");
    }
}
