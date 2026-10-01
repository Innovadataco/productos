/**
 * SPEC-796 · POST — nuestro ADMIN adjunta el contrato firmado de un colegio.
 *
 * `[id]` = suscripcionId (la ficha cliente del admin). Solo suscripciones de COLEGIO. El archivo va
 * cifrado y opaco (contrato-colegio-storage); se registra el hecho append-only (ContratoColegio).
 * Guardia de SERVIDOR (rol admin + módulo), no esconder un botón. Multipart con `archivo` (solo PDF).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { checkRateLimit } from "@/lib/rate-limit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";
import { adjuntarContratoColegio } from "@/lib/colegio/contrato-colegio.service";
import { topeAutorizacionMb } from "@/lib/profesional/tope-subida";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("ADMIN");
        await assertModulo(user, "pagos_admin");
        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id: suscripcionId } = await params;
        const suscripcion = await new PagosRepository().obtenerSuscripcionPorId(suscripcionId);
        if (!suscripcion || !suscripcion.colegioId) {
            // El contrato firmado es de un colegio; una suscripción de padre no lo tiene.
            return NextResponse.json(
                { error: { message: "El contrato firmado solo aplica a suscripciones de colegio.", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const colegio = await new ColegioRepository().obtenerResumen(suscripcion.colegioId);
        if (!colegio) {
            return NextResponse.json(
                { error: { message: "No encontramos el colegio de esta suscripción.", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const form = await request.formData().catch(() => null);
        const archivo = form?.get("archivo");
        // Chequeo estructural (no `instanceof File`: realms undici/jsdom), mismo patrón que /autorizacion.
        const esArchivo =
            archivo !== null &&
            archivo !== undefined &&
            typeof archivo !== "string" &&
            typeof (archivo as { arrayBuffer?: unknown }).arrayBuffer === "function";
        if (!esArchivo) {
            return NextResponse.json(
                { error: { message: "Adjunte el contrato firmado (campo `archivo`).", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await (archivo as Blob).arrayBuffer());
        const maxMb = await topeAutorizacionMb(); // reusa el tope de documentos legales (un PDF firmado)
        const resultado = await adjuntarContratoColegio({
            colegio: { id: colegio.id, nombre: colegio.nombre, nit: colegio.nit },
            suscripcionId,
            buffer,
            admin: { id: user.id, nombre: user.nombre, email: user.email },
            maxBytes: maxMb * 1024 * 1024,
            maxMb,
        });
        if (!resultado.ok) {
            return NextResponse.json(
                { error: { message: resultado.motivo, code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        // Sin la ruta ni el id del archivo en la respuesta: solo el hecho.
        return NextResponse.json({ data: { contratoId: resultado.contratoId, adjuntadoEn: resultado.adjuntadoEn.toISOString() } }, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/CLIENTE/CONTRATO/POST]");
    }
}
