/**
 * SPEC-391 (A-75 · L1b) · POST /api/profesional/autorizacion.
 *
 * El profesional sube el documento firmado que autoriza la consulta de
 * antecedentes (Ley 2375/2024 · previa, expresa, escrita, archivada). Multipart
 * form-data con un solo campo `archivo`. Se acepta PDF, PNG o JPG (validación
 * por magia de bytes — no por extensión), tope 5 MB.
 *
 * Guarda el archivo cifrado (AES-256-GCM) en el storage protegido y persiste
 * en el perfil `autorizacionArchivoId` (uuid opaco) + `autorizacionSubidaEn`
 * (fecha, para demostrar que la autorización fue PREVIA a cada verificación
 * — el brief §5 + veredicto CEO 08:40).
 *
 * Al terminar, si el perfil ya está completo, transiciona a `EN_REVISION`.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { checkRateLimit } from "@/lib/rate-limit";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import {
    guardarAutorizacion,
    validarAutorizacion,
} from "@/lib/profesional/autorizacion-storage";
import {
    perfilCompletoParaRevision,
    toPerfilProfesionalPropio,
} from "@/lib/profesional/dto";

async function requireProfesional() {
    const user = await verifyAuth();
    if (user.rol !== "PROFESIONAL") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
    // SPEC-496: el rol es la primera puerta; el módulo es la segunda. Revocar
    // `profesional_ficha` corta el acceso, no solo el ítem del menú.
    await assertModulo(user, "profesional_ficha");
    return user;
}

export async function POST(request: Request) {
    try {
        const user = await requireProfesional();
        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        // El profesional necesita tener perfil (aunque en BORRADOR); el archivo
        // se persiste asociado al perfil. Si no hay perfil, PUT /perfil primero.
        const repo = new PerfilProfesionalRepository();
        const perfil = await repo.findPorUsuarioId(user.id);
        if (!perfil) {
            return NextResponse.json(
                { error: { message: "Completa tu perfil antes de subir la autorización.", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const form = await request.formData().catch(() => null);
        const archivo = form?.get("archivo");
        // Chequeo estructural (no `instanceof File`): undici y jsdom producen
        // Files de realms distintos (patrón de api/pagos/renovacion/route.ts).
        // Lo que importa es que sea un blob con arrayBuffer leíble.
        const esArchivo =
            archivo !== null &&
            archivo !== undefined &&
            typeof archivo !== "string" &&
            typeof (archivo as { arrayBuffer?: unknown }).arrayBuffer === "function";
        if (!esArchivo) {
            return NextResponse.json(
                { error: { message: "Adjunta el archivo firmado (campo `archivo`).", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await (archivo as Blob).arrayBuffer());
        const validacion = validarAutorizacion(buffer);
        if (!validacion.ok) {
            return NextResponse.json(
                { error: { message: validacion.motivo, code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const guardado = await guardarAutorizacion(buffer, validacion.extension);

        const actualizado = await repo.actualizarParcial(perfil.id, {
            autorizacionArchivoId: guardado.archivoId,
            autorizacionSubidaEn: new Date(),
        });

        // Igual que PUT /perfil: si con esta subida quedó completo y estaba en
        // BORRADOR, pasa a EN_REVISION. Otros estados no se tocan desde acá.
        const final =
            actualizado.estado === "BORRADOR" && perfilCompletoParaRevision(actualizado)
                ? await repo.cambiarEstado(actualizado.id, "EN_REVISION")
                : actualizado;

        return NextResponse.json({ perfil: toPerfilProfesionalPropio(final) }, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/AUTORIZACION]");
    }
}
