/**
 * SPEC-211 (002-PI-111): POST /api/pagos/renovacion
 *
 * Registra una renovación con comprobante de pago (multipart/form-data):
 * valida campos con Zod, tamaño/tipo del archivo según parámetros, calcula
 * SHA256, guarda el comprobante cifrado y crea el `Pago` en
 * PENDIENTE_AUTORIZACION. La autorización es del admin (SPEC-212).
 */
import { NextResponse } from "next/server";
import type { DuracionPlan, MetodoPago } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { pagosRenovacionCamposSchema } from "@/lib/schemas/pagos";
import { formatZodError, ValidationError } from "@/lib/validation";
import { registrarRenovacion } from "@/lib/pagos/renovacion.service";
import { verificarTitularidad } from "@/lib/pagos/suscripcion-vista.service";
import { getClientInfo } from "@/lib/pagos/api-helpers";
import { auditAccesoDenegado } from "@/lib/audit";

function campoTexto(valor: FormDataEntryValue | null): string | undefined {
    if (typeof valor !== "string") return undefined;
    const limpio = valor.trim();
    return limpio.length > 0 ? limpio : undefined;
}

export async function POST(request: Request) {
    try {
        const usuario = await verifyAuth(["SCHOOL_ADMIN", "PARENT"]);
        const rate = await checkRateLimit(request, "pagos_write", { identifier: usuario.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const formData = await request.formData();
        const parsed = pagosRenovacionCamposSchema.safeParse({
            suscripcionId: campoTexto(formData.get("suscripcionId")),
            duracion: campoTexto(formData.get("duracion")),
            metodoDeclarado: campoTexto(formData.get("metodoDeclarado")),
            notas: campoTexto(formData.get("notas")),
            codigoReferido: campoTexto(formData.get("codigoReferido")),
            codigoBono: campoTexto(formData.get("codigoBono")),
        });
        if (!parsed.success) {
            throw new ValidationError("Datos de renovación inválidos", formatZodError(parsed.error));
        }

        const archivo = formData.get("comprobante");
        // Chequeo estructural (no `instanceof File`): undici y jsdom producen Files de
        // realms distintos (patrón de api/apelaciones/route.ts); lo que importa es que
        // sea un archivo con contenido leíble.
        const esArchivo =
            archivo !== null &&
            typeof archivo === "object" &&
            typeof (archivo as File).arrayBuffer === "function" &&
            typeof (archivo as File).type === "string";
        if (!esArchivo || (archivo as File).size === 0) {
            throw new AppError("El comprobante de pago es obligatorio", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        const buffer = Buffer.from(await (archivo as File).arrayBuffer());

        const { ipAddress, userAgent } = getClientInfo(request);
        // Titularidad en la ruta para auditar el intento de acceso a suscripciones
        // ajenas con el código correcto (el servicio re-verifica por su cuenta).
        const propia = await verificarTitularidad(parsed.data.suscripcionId, usuario);
        if (!propia) {
            await auditAccesoDenegado({
                request,
                usuarioId: usuario.id,
                recurso: "RenovacionSuscripcion",
                metadatos: { suscripcionId: parsed.data.suscripcionId },
            });
            throw new AppError("Suscripción no encontrada o no pertenece al usuario", ERROR_CODES.NOT_FOUND, 404);
        }

        const resultado = await registrarRenovacion({
            suscripcionId: parsed.data.suscripcionId,
            duracion: parsed.data.duracion as DuracionPlan,
            metodoDeclarado: parsed.data.metodoDeclarado as MetodoPago,
            notas: parsed.data.notas,
            codigoReferido: parsed.data.codigoReferido,
            codigoBono: parsed.data.codigoBono,
            comprobante: { buffer, mimeType: archivo.type },
            usuario,
            ipAddress,
            userAgent,
        });
        return NextResponse.json(resultado, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[PAGOS/RENOVACION]");
    }
}
