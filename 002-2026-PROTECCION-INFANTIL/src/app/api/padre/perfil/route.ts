import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";

// SPEC-334: teléfono con validación mínima (7-20 dígitos, permite + espacios guiones).
const telefonoRegex = /^[+\d][\d\s-]{6,19}$/;

const perfilSchema = z.object({
    nombre: z.string().trim().min(1, "Escribe tus nombres").max(120).optional(),
    apellidos: z.string().trim().min(1, "Escribe tus apellidos").max(120).optional(),
    fechaNacimiento: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
        .optional()
        .nullable(),
    telefono: z
        .string()
        .trim()
        .regex(telefonoRegex, "Teléfono inválido (7 a 20 dígitos)")
        .optional()
        .nullable(),
    paisId: z.string().trim().min(1).optional().nullable(),
    ciudadId: z.string().trim().min(1).optional().nullable(),
});

export async function GET() {
    try {
        const user = await verifyAuth("PARENT");
        const perfil = await new UsuarioRepository().obtenerPerfilPadre(user.id);
        if (!perfil) {
            throw new AppError("Perfil no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return NextResponse.json({ perfil });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return errorToResponse(error, "[PADRE/PERFIL/GET]");
    }
}

export async function PATCH(request: Request) {
    try {
        const user = await verifyAuth("PARENT");
        const body = await request.json();
        const parsed = perfilSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: parsed.error.issues[0]?.message ?? "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        // Solo incluimos las claves presentes (evita pasar `undefined` explícito).
        const d = parsed.data;
        const data: Prisma.UsuarioUncheckedUpdateInput = {};
        if (d.nombre !== undefined) data.nombre = d.nombre;
        if (d.apellidos !== undefined) data.apellidos = d.apellidos;
        if (d.telefono !== undefined) data.telefono = d.telefono;
        if (d.paisId !== undefined) data.paisId = d.paisId;
        if (d.ciudadId !== undefined) data.ciudadId = d.ciudadId;
        if (d.fechaNacimiento !== undefined) {
            data.fechaNacimiento = d.fechaNacimiento ? new Date(`${d.fechaNacimiento}T00:00:00.000Z`) : null;
        }
        await new UsuarioRepository().actualizarPerfilPadre(user.id, data);
        const perfil = await new UsuarioRepository().obtenerPerfilPadre(user.id);
        return NextResponse.json({ perfil });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return errorToResponse(error, "[PADRE/PERFIL/PATCH]");
    }
}
