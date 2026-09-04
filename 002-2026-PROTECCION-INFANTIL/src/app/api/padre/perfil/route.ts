import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { sellarCookieSesionEstado } from "@/lib/routing/sellar-sesion-estado";
import { DOCUMENTO_TIPOS_PADRE } from "@/lib/validators";

// SPEC-334: teléfono con validación mínima (7-20 dígitos, permite + espacios guiones).
const telefonoRegex = /^[+\d][\d\s-]{6,19}$/;

const perfilSchema = z.object({
    nombre: z.string().trim().min(1, "Escribe tus nombres").max(120).optional(),
    apellidos: z.string().trim().min(1, "Escribe tus apellidos").max(120).optional(),
    // SPEC-339 (A-67 §2.3): documento del padre — obligatorio en el Paso 2 del
    // camino (la obligatoriedad la impone derivarPasoPendiente, no este esquema:
    // el perfil se puede guardar por partes).
    documentoTipo: z.enum(DOCUMENTO_TIPOS_PADRE).optional(),
    documentoNumero: z.string().trim().min(3, "Escribe el número de documento").max(40).optional(),
    // SPEC-339 (D-2): fechaNacimiento deja de pedirse en el camino. Se ACEPTA
    // aún (la pantalla de perfil fuera del camino puede seguir mandándola y el
    // campo vive en la BD); simplemente ya no es parte del Paso 2.
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
    // SPEC-440 P5 (Jelkin vivo 04-09): presentación/urgencia estándar del
    // padre, guardadas al enviar el form de búsqueda de psicólogo — para no
    // volver a pedirlas la próxima. Rangos alineados con `PresentacionUrgenciaForm`.
    presentacionEstandar: z.string().trim().min(10, "La presentación debe tener al menos 10 caracteres").max(500).optional().nullable(),
    urgenciaEstandar: z.enum(["ESTA_SEMANA", "SIN_APURO"]).optional().nullable(),
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
        if (d.documentoTipo !== undefined) data.documentoTipo = d.documentoTipo;
        if (d.documentoNumero !== undefined) data.documentoNumero = d.documentoNumero;
        if (d.telefono !== undefined) data.telefono = d.telefono;
        if (d.paisId !== undefined) data.paisId = d.paisId;
        if (d.ciudadId !== undefined) data.ciudadId = d.ciudadId;
        if (d.fechaNacimiento !== undefined) {
            data.fechaNacimiento = d.fechaNacimiento ? new Date(`${d.fechaNacimiento}T00:00:00.000Z`) : null;
        }
        if (d.presentacionEstandar !== undefined) data.presentacionEstandar = d.presentacionEstandar;
        if (d.urgenciaEstandar !== undefined) data.urgenciaEstandar = d.urgenciaEstandar;
        await new UsuarioRepository().actualizarPerfilPadre(user.id, data);
        const perfil = await new UsuarioRepository().obtenerPerfilPadre(user.id);
        const res = NextResponse.json({ perfil });
        // SPEC-339 (T072): guardar el perfil puede CERRAR el Paso 2 del camino.
        // Sin re-sellar acá, el padre completa sus datos y la cookie sigue
        // diciendo "Paso 2" hasta vencer (5 min) — la clase de bug
        // I-211/222/224/227.
        // Defensa: el helper promete no lanzar, pero si un cambio futuro rompe esa
        // promesa, el dato guardado no puede convertirse en un 500.
        const sellada = await sellarCookieSesionEstado(res, user.id).catch(() => false);
        if (!sellada) {
            // T079 (Calidad · R1-8): el dato quedó guardado, pero el padre debe
            // saberlo — no repetir el paso "en silencio".
            return NextResponse.json({
                perfil,
                aviso: "Guardamos tus datos. Si la página no avanza en un momento, recárgala.",
            });
        }
        return res;
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return errorToResponse(error, "[PADRE/PERFIL/PATCH]");
    }
}
