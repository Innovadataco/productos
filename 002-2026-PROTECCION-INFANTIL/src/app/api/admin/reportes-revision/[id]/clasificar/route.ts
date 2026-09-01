/**
 * A-70 · B2 — clasificación MANUAL del operador.
 *
 * El vacío que cerró este endpoint: un reporte que cae a `REVISION_MANUAL`
 * ANTES de que el motor lo clasifique no tiene `ClasificacionIA`, y las dos
 * vías existentes la exigen —`/confirmar` responde 400 "El reporte no tiene
 * clasificación" y `/api/admin/correcciones` responde 409 "no tiene
 * clasificación que corregir"—. El caso quedaba atascado para siempre: el
 * operador solo veía revelar, escalar y dar de baja, sin la acción principal
 * de su trabajo.
 *
 * Acá el operador CREA la clasificación (categoría del catálogo + nota
 * obligatoria) y el reporte sale del limbo a CLASIFICADO. Si ya existe una
 * clasificación, este endpoint NO la pisa: devuelve 409 y remite a la vía de
 * corrección, que lleva su propia auditoría de categoría anterior→nueva.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { CategoriaConducta } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { esAdminRol, puedeGestionarReporte } from "@/lib/operadores/permisos";
import { registrarTransicion, responsableTipoFromRol } from "@/lib/reporte-transiciones";
import { actualizarVisibilidadPublica } from "@/lib/visibility";
import { recalcularYGuardarScore } from "@/lib/scoring";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { ClasificacionIARepository } from "@/lib/dal/repositories/clasificacion-ia";
import { CorreccionAdminRepository } from "@/lib/dal/repositories/correccion-admin";

/** El catálogo COMPLETO del enum — sin lista paralela que se desincronice. */
const CATEGORIAS = Object.values(CategoriaConducta) as [string, ...string[]];

const clasificarSchema = z.object({
    categoria: z.enum(CATEGORIAS),
    // La nota es el porqué de la decisión humana: obligatoria para que el
    // caso quede auditable (quién clasificó, en qué categoría y con qué razón).
    nota: z.string().trim().min(10, "La nota debe explicar el criterio (mínimo 10 caracteres)").max(2000),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "bandeja_reportes");
        if (!esAdminRol(user.rol) && user.rol !== "OPERADOR") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
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

        const { id: rawId } = await params;
        const parsedId = idSchema.safeParse(rawId);
        if (!parsedId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const id = parsedId.data;

        const parsed = clasificarSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            const primero = parsed.error.issues[0];
            return NextResponse.json(
                { error: { message: primero?.message ?? "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { categoria, nota } = parsed.data;

        const reporte = await new ReporteRepository().findByIdConClasificacion(id);
        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        if (!puedeGestionarReporte(user, reporte)) {
            return NextResponse.json(
                { error: { message: "No tienes permiso para gestionar este caso", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }
        if (reporte.eliminado) {
            return NextResponse.json(
                { error: { message: "No se puede clasificar un reporte dado de baja", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }
        if (reporte.clasificacion) {
            // Ya hay clasificación: corregirla es otro camino, con su propia
            // auditoría de anterior→nueva. Acá no la pisamos en silencio.
            return NextResponse.json(
                {
                    error: {
                        message: "Este reporte ya tiene clasificación; use la corrección de categoría",
                        code: ERROR_CODES.CONFLICT,
                    },
                },
                { status: 409 }
            );
        }

        const estadoAnterior = reporte.estado;
        const responsableTipo = responsableTipoFromRol(user.rol) ?? "ADMIN";

        await withUnitOfWork(async (tx) => {
            const clasificacion = await new ClasificacionIARepository(tx).crear({
                reporteId: id,
                categoria: categoria as CategoriaConducta,
                // Decisión humana: certeza plena, sin latencia de modelo. `modeloUsado`
                // deja la huella de que NO salió del motor (los tableros de deriva y
                // los datasets filtran por este campo).
                confianza: 1,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "manual:operador",
                latenciaMs: 0,
            });

            // La nota vive en la corrección, que es el registro auditable de la
            // decisión: original = corregida (no hubo veredicto previo del motor).
            await new CorreccionAdminRepository(tx).crear({
                clasificacionId: clasificacion.id,
                categoriaOriginal: categoria as CategoriaConducta,
                categoriaCorregida: categoria as CategoriaConducta,
                adminId: user.id,
                motivo: nota,
                confirmada: true,
            });

            await registrarTransicion({
                reporteId: id,
                estadoAnterior,
                estadoNuevo: "CLASIFICADO",
                responsableTipo,
                responsableId: user.id,
                motivo: `Clasificación manual del operador: ${categoria}`,
                tx,
            });
            await new ReporteRepository(tx).actualizarEstado(id, { estado: "CLASIFICADO" });
        });

        await actualizarVisibilidadPublica(reporte.identificador, reporte.plataformaId);
        const scoreResult = await recalcularYGuardarScore(reporte.identificador, reporte.plataformaId);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "CASO_CONFIRMADO",
            tipoRecurso: "Reporte",
            recursoId: id,
            usuarioId: user.id,
            valorAnterior: JSON.stringify({ estado: estadoAnterior, categoria: null }),
            valorNuevo: JSON.stringify({ estado: "CLASIFICADO", categoria, origen: "manual", nota }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({
            reporteId: id,
            categoria,
            estado: "CLASIFICADO",
            origen: "manual",
            score: scoreResult.score,
            nivelRiesgo: scoreResult.nivelRiesgo,
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[CLASIFICAR-MANUAL] error interno:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
