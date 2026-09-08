import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { sellarCookieSesionEstado } from "@/lib/routing/sellar-sesion-estado";
import { DOCUMENTO_TIPOS_PADRE } from "@/lib/validators";
import { validarFechaNacimientoPadre } from "@/lib/padre/fecha-nacimiento-padre";
import { detectarCambiosPerfil } from "@/lib/padre/perfil-cambios";
import { logAudit } from "@/lib/audit";
import { enviarAvisoCambioEmail } from "@/lib/email-padre";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

// SPEC-334: teléfono con validación mínima (7-20 dígitos, permite + espacios guiones).
const telefonoRegex = /^[+\d][\d\s-]{6,19}$/;

const perfilSchema = z.object({
    // SPEC-590 (decisión CEO 06-09): el email del padre es editable desde el
    // perfil. Se normaliza a minúsculas + trim — el mismo criterio que login
    // (SPEC-579) y OAuth (SPEC-587) — para que la unicidad case-insensitive
    // sea una unicidad real.
    email: z.string().trim().toLowerCase().email("Escribe un correo válido").max(255).optional(),
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
    // SPEC-541 (P2): además del formato, la edad debe ser de 18 a 100 años y la
    // fecha no puede ser futura (antes aceptaba 1900 y fechas futuras).
    fechaNacimiento: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
        .superRefine((v, ctx) => {
            const err = validarFechaNacimientoPadre(v);
            if (err) ctx.addIssue({ code: z.ZodIssueCode.custom, message: err });
        })
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

// SPEC-590: unicidad case-insensitive del email (ya normalizado por Zod).
async function verificarEmailDisponible(userId: string, email: string): Promise<void> {
    const ocupante = await new UsuarioRepository().findByEmail(email);
    if (ocupante && ocupante.id !== userId) {
        throw new AppError("Ese correo ya está en uso.", ERROR_CODES.CONFLICT, 409);
    }
}

type CambioPerfil = ReturnType<typeof detectarCambiosPerfil>[number];

// Solo incluimos las claves presentes (evita pasar `undefined` explícito).
function construirDataActualizacion(d: z.infer<typeof perfilSchema>): Prisma.UsuarioUncheckedUpdateInput {
    const data: Prisma.UsuarioUncheckedUpdateInput = {};
    if (d.email !== undefined) data.email = d.email;
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
    return data;
}

// SPEC-590: historial de cambios de «Mi perfil» (decisión CEO). Una fila por
// campo, con anterior→nuevo; el email completo SÍ (dato del propio titular y
// el CEO lo pidió explícito). Nunca texto de reportes.
async function auditarCambiosPerfil(userId: string, cambios: CambioPerfil[], request: Request): Promise<void> {
    const { ipAddress, userAgent } = getClientInfo(request);
    for (const cambio of cambios) {
        await logAudit({
            accion: "PERFIL_CAMBIO",
            tipoRecurso: "Usuario",
            recursoId: userId,
            usuarioId: userId,
            valorAnterior: JSON.stringify({ campo: cambio.campo, valor: cambio.anterior }),
            valorNuevo: JSON.stringify({ campo: cambio.campo, valor: cambio.nuevo }),
            ipAddress,
            userAgent,
        });
    }
}

// SPEC-590: aviso de seguridad al correo NUEVO cuando cambia. Si el envío
// falla NO se bloquea el cambio: el aviso queda en log.
async function avisarCambioEmail(cambios: CambioPerfil[], emailNuevo: string | undefined): Promise<void> {
    if (cambios.some((c) => c.campo === "email") && emailNuevo) {
        await enviarAvisoCambioEmail(emailNuevo).catch((e: unknown) => {
            console.error("[PerfilPadre] Aviso cambio email: fallo —", e instanceof Error ? e.message : e);
        });
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
        // Solo incluimos las claves presentes — ver `construirDataActualizacion`.
        const d = parsed.data;
        if (d.email !== undefined) {
            await verificarEmailDisponible(user.id, d.email);
        }
        const repo = new UsuarioRepository();
        // SPEC-590: la auditoría compara contra el valor ANTERIOR — se lee antes
        // de escribir. Un AuditLog por campo cambiado (AccionAudit PERFIL_CAMBIO).
        const anterior = await repo.obtenerPerfilPadre(user.id);
        const cambios = anterior
            ? detectarCambiosPerfil(
                {
                    email: anterior.email,
                    nombre: anterior.nombre,
                    apellidos: anterior.apellidos,
                    documentoTipo: anterior.documentoTipo,
                    documentoNumero: anterior.documentoNumero,
                    fechaNacimiento: anterior.fechaNacimiento,
                    telefono: anterior.telefono,
                    paisId: anterior.paisId,
                    ciudadId: anterior.ciudadId,
                },
                {
                    email: d.email,
                    nombre: d.nombre,
                    apellidos: d.apellidos,
                    documentoTipo: d.documentoTipo,
                    documentoNumero: d.documentoNumero,
                    telefono: d.telefono,
                    paisId: d.paisId,
                    ciudadId: d.ciudadId,
                    ...(d.fechaNacimiento !== undefined ? { fechaNacimiento: d.fechaNacimiento } : {}),
                }
            )
            : [];
        const data = construirDataActualizacion(d);
        await repo.actualizarPerfilPadre(user.id, data);
        await auditarCambiosPerfil(user.id, cambios, request);
        await avisarCambioEmail(cambios, d.email);
        const perfil = await repo.obtenerPerfilPadre(user.id);
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
