/**
 * SPEC-436 (I-304) · los documentos que el profesional carga para su verificación.
 *
 * GET  · qué tiene cargado (derivado del parámetro `verificacion.requisitos`).
 * POST · sube o reemplaza el documento de un requisito. Multipart con `archivo`
 *        y `requisito`. Mismo tratamiento que la autorización: cifrado, nombre
 *        opaco, 5 MB, validación por número mágico.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { checkRateLimit } from "@/lib/rate-limit";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import {
    estadoDeDocumentos,
    guardarDocumentoDeRequisito,
} from "@/lib/profesional/documentos.service";

async function perfilDelProfesional() {
    const user = await verifyAuth("PROFESIONAL");
    await assertModulo(user, "profesional_ficha");
    const perfil = await new PerfilProfesionalRepository().findPorUsuarioId(user.id);
    if (!perfil) {
        throw new AppError(
            "Completa tu perfil antes de cargar documentos.",
            ERROR_CODES.VALIDATION_ERROR,
            400
        );
    }
    return { user, perfil };
}

export async function GET() {
    try {
        const { perfil } = await perfilDelProfesional();
        return NextResponse.json({ data: await estadoDeDocumentos(perfil.id) });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/DOCUMENTOS/GET]");
    }
}

export async function POST(request: Request) {
    try {
        const { user, perfil } = await perfilDelProfesional();
        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const form = await request.formData().catch(() => null);
        const requisito = form?.get("requisito");
        const archivo = form?.get("archivo");
        if (typeof requisito !== "string" || requisito.length === 0) {
            return NextResponse.json(
                { error: { message: "Indique a qué requisito corresponde (campo `requisito`).", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        // Chequeo estructural, no `instanceof File`: undici y jsdom producen
        // Files de realms distintos (mismo patrón que POST /autorizacion).
        const esArchivo =
            archivo !== null &&
            archivo !== undefined &&
            typeof archivo !== "string" &&
            typeof (archivo as { arrayBuffer?: unknown }).arrayBuffer === "function";
        if (!esArchivo) {
            return NextResponse.json(
                { error: { message: "Adjunte el archivo (campo `archivo`).", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await (archivo as Blob).arrayBuffer());
        await guardarDocumentoDeRequisito(perfil.id, requisito, buffer);
        return NextResponse.json({ data: await estadoDeDocumentos(perfil.id) }, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/DOCUMENTOS/POST]");
    }
}
