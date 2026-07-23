import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { RolUsuario, CasoEvalFuente, type Prisma } from "@prisma/client";
import { z } from "zod";

const CASOS_POR_PAGINA = 25;

const CATEGORIAS = [
    "CONTACTO_INSISTENTE",
    "SOLICITUD_MATERIAL",
    "OFRECIMIENTO_REGALOS",
    "SUPLANTACION_IDENTIDAD",
    "SOLICITUD_ENCUENTRO",
    "COMPARTIMIENTO_SEXUAL",
    "OTRO",
    "EXTORSION",
    "CONTENIDO_GENERADO_IA",
    "DIFUSION_NO_CONSENTIDA",
    "DOXING",
] as const;

const casoSchema = z.object({
    texto: z.string().min(5, "El texto debe tener al menos 5 caracteres").max(4000, "Máximo 4000 caracteres"),
    categoriaEsperada: z.enum(CATEGORIAS),
    secundariaEsperada: z.enum(CATEGORIAS).optional(),
    ruido: z.boolean().default(false),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function GET(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_eval");

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { searchParams } = new URL(request.url);
        const categoria = searchParams.get("categoria") || undefined;
        const ruidoRaw = searchParams.get("ruido");
        const ruido = ruidoRaw === null ? undefined : ruidoRaw === "true";
        const fuente = searchParams.get("fuente") || undefined;
        const activoRaw = searchParams.get("activo");
        const activo = activoRaw === null ? undefined : activoRaw === "true";
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

        const where: Prisma.CasoEvalWhereInput = {};
        if (categoria) where.categoriaEsperada = categoria;
        if (ruido !== undefined) where.ruido = ruido;
        if (fuente) where.fuente = fuente as CasoEvalFuente;
        if (activo !== undefined) where.activo = activo;

        const [items, total, porCategoria] = await prisma.$transaction([
            prisma.casoEval.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip: (page - 1) * CASOS_POR_PAGINA,
                take: CASOS_POR_PAGINA,
                include: { creadoPor: { select: { email: true, nombre: true } } },
            }),
            prisma.casoEval.count({ where }),
            prisma.casoEval.groupBy({
                by: ["categoriaEsperada"],
                where: { activo: true },
                orderBy: { categoriaEsperada: "asc" },
                _count: { categoriaEsperada: true },
            }),
        ]);

        const conteosPorCategoria = Object.fromEntries(
            porCategoria.map((g) => [g.categoriaEsperada, (g._count as { categoriaEsperada: number }).categoriaEsperada ?? 0])
        );

        return NextResponse.json({
            items,
            pagination: { page, totalPages: Math.ceil(total / CASOS_POR_PAGINA), total },
            conteosPorCategoria,
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_eval");

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await request.json();
        const parsed = casoSchema.safeParse(body);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            throw new AppError(first?.message || "Datos inválidos", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const nextVersion = await prisma.casoEval
            .findMany({ orderBy: { fixtureVersion: "desc" }, take: 1 })
            .then((rows) => (rows[0]?.fixtureVersion ?? 0) + 1);

        const creado = await prisma.casoEval.create({
            data: {
                texto: parsed.data.texto,
                categoriaEsperada: parsed.data.categoriaEsperada,
                secundariaEsperada: parsed.data.secundariaEsperada || null,
                ruido: parsed.data.ruido,
                fuente: CasoEvalFuente.MANUAL_ADMIN,
                activo: true,
                fixtureVersion: nextVersion,
                creadoPorId: user.id,
            },
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "EVAL_CASE_CREATE",
            tipoRecurso: "CasoEval",
            recursoId: creado.id,
            usuarioId: user.id,
            valorNuevo: JSON.stringify({
                categoriaEsperada: creado.categoriaEsperada,
                secundariaEsperada: creado.secundariaEsperada,
                ruido: creado.ruido,
                fixtureVersion: creado.fixtureVersion,
            }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ caso: creado, fixtureVersion: nextVersion }, { status: 201 });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
