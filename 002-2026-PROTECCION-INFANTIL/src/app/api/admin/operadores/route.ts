import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAuth, hashPassword } from "@/lib/auth";
import { ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { enviarEmailBienvenidaOperador } from "@/lib/email";
import { randomBytes } from "crypto";

const operadorSchema = z.object({
    email: z.string().email(),
    nombre: z.string().min(2).max(100),
    cupoMaximo: z.coerce.number().int().min(1).max(200).optional(),
    esRevisorDeApelaciones: z.boolean().optional(),
    notasInternas: z.string().max(500).optional(),
});

function tempPassword() {
    return randomBytes(6).toString("hex");
}

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

function filtroTenant(admin: { rol: string; tenantId: string | null }) {
    if (admin.rol === "ADMIN") return {};
    return { tenantId: admin.tenantId ?? null };
}

export async function GET(request: Request) {
    try {
        const admin = await verifyAuth(["ADMIN", "SCHOOL_ADMIN"]);
        const operadores = await prisma.usuario.findMany({
            where: { rol: "OPERADOR", ...filtroTenant(admin) },
            include: { perfilOperador: true },
            orderBy: { creadoEn: "desc" },
        });

        const conConteo = await Promise.all(
            operadores.map(async (op) => {
                const casosAbiertos = await prisma.reporte.count({
                    where: { operadorId: op.id, estado: "REVISION_MANUAL", eliminado: false },
                });
                const casosTotales = await prisma.reporte.count({
                    where: { operadorId: op.id, eliminado: false },
                });
                return {
                    id: op.id,
                    email: op.email,
                    nombre: op.nombre,
                    estado: op.estado,
                    tenantId: op.tenantId,
                    perfil: op.perfilOperador
                        ? {
                              cupoMaximo: op.perfilOperador.cupoMaximo,
                              esRevisorDeApelaciones: op.perfilOperador.esRevisorDeApelaciones,
                              notasInternas: op.perfilOperador.notasInternas,
                              creadoPorId: op.perfilOperador.creadoPorId,
                          }
                        : null,
                    casosAbiertos,
                    casosTotales,
                };
            })
        );

        return NextResponse.json({ operadores: conConteo });
    } catch (error) {
        if (error instanceof Error && "code" in error && typeof error.code === "string") {
            return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: 403 });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const admin = await verifyAuth(["ADMIN", "SCHOOL_ADMIN"]);
        const body = await request.json();
        const parsed = operadorSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const existe = await prisma.usuario.findUnique({ where: { email: parsed.data.email } });
        if (existe) {
            return NextResponse.json(
                { error: { message: "Ya existe un usuario con ese email", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 409 }
            );
        }

        const password = tempPassword();
        const passwordHash = await hashPassword(password);
        const { ipAddress, userAgent } = getClientInfo(request);

        const operador = await prisma.usuario.create({
            data: {
                email: parsed.data.email,
                nombre: parsed.data.nombre,
                passwordHash,
                rol: "OPERADOR",
                estado: "activo",
                tenantId: admin.tenantId,
                perfilOperador: {
                    create: {
                        cupoMaximo: parsed.data.cupoMaximo ?? 10,
                        esRevisorDeApelaciones: parsed.data.esRevisorDeApelaciones ?? false,
                        notasInternas: parsed.data.notasInternas,
                        creadoPorId: admin.id,
                    },
                },
            },
            include: { perfilOperador: true },
        });

        await logAudit({
            accion: "OPERADOR_CREADO",
            tipoRecurso: "Usuario",
            recursoId: operador.id,
            usuarioId: admin.id,
            valorNuevo: JSON.stringify({ email: operador.email, nombre: operador.nombre, rol: operador.rol }),
            ipAddress,
            userAgent,
        });

        try {
            await enviarEmailBienvenidaOperador(operador.email, password);
        } catch (err) {
            console.error("[OPERADORES] Error enviando email de bienvenida", err);
        }

        return NextResponse.json({
            operador: {
                id: operador.id,
                email: operador.email,
                nombre: operador.nombre,
                estado: operador.estado,
                perfil: operador.perfilOperador,
            },
            mensaje: "Operador creado. Se envió la contraseña temporal por email.",
        });
    } catch (error) {
        if (error instanceof Error && "code" in error && typeof error.code === "string") {
            return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: 403 });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
