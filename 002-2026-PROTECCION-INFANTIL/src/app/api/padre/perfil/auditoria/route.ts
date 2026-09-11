/**
 * SPEC-590 · «Historial de cambios» de «Mi perfil».
 * SPEC-628 · en ESPAÑOL y SIN identificadores internos: los campos con id/clave
 * (país, ciudad, tipo de documento) se resuelven a su NOMBRE, y el historial
 * incluye los cambios de AVISO (prender/apagar) resueltos a su frase. Ningún
 * item expone un id, un código, una clave de evento ni un nombre de columna.
 *
 * El scope es SIEMPRE el usuario de la sesión: este endpoint NUNCA acepta un
 * usuarioId por query — el historial es solo del titular.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { AuditLogRepository } from "@/lib/dal/repositories/audit-log";
import { CiudadRepository } from "@/lib/dal/repositories/ciudad";
import { PaisRepository } from "@/lib/dal/repositories/pais";
import { TipoDocumentoRepository } from "@/lib/dal/repositories/tipo-documento";
import {
    construirItemsHistorial,
    type FilaAudit,
    type MapasResolucion,
} from "@/lib/padre/perfil-cambios";

const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** Ids de ciudad que aparecen como valor de un cambio de `ciudadId` (para el
 *  batch de nombres; el catálogo de ciudades es grande, se filtra por id). */
function ciudadIdsDe(filas: FilaAudit[]): string[] {
    const ids = new Set<string>();
    for (const f of filas) {
        for (const json of [f.valorAnterior, f.valorNuevo]) {
            if (!json) continue;
            try {
                const d = JSON.parse(json) as { campo?: unknown; valor?: unknown };
                if (d.campo === "ciudadId" && typeof d.valor === "string" && d.valor) {
                    ids.add(d.valor);
                }
            } catch {
                /* fila corrupta: la ignora el builder */
            }
        }
    }
    return [...ids];
}

export async function GET(request: Request) {
    try {
        const user = await verifyAuth("PARENT");
        const url = new URL(request.url);
        const parsed = querySchema.safeParse({
            page: url.searchParams.get("page") ?? undefined,
            pageSize: url.searchParams.get("pageSize") ?? undefined,
        });
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de paginación inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { page, pageSize } = parsed.data;
        // Scope SIEMPRE el usuario de la sesión: la query no acepta usuarioId.
        const [filas, total] = await new AuditLogRepository().cambiosPerfilPaginados(user.id, {
            skip: (page - 1) * pageSize,
            take: pageSize,
        });

        // Batch de nombres (país y tipo de documento son catálogos chicos → completos;
        // ciudad es grande → solo los ids que aparecen). Nunca se muestra el id.
        const [ciudades, paises, tiposDoc] = await Promise.all([
            new CiudadRepository().findManyConCoords(ciudadIdsDe(filas)),
            new PaisRepository().listarActivos(),
            new TipoDocumentoRepository().listar(),
        ]);
        const mapas: MapasResolucion = {
            ciudades: new Map(ciudades.map((c) => [c.id, c.nombre])),
            paises: new Map(paises.map((p) => [p.id, p.nombre])),
            tiposDoc: new Map(tiposDoc.map((t) => [t.clave, t.nombre])),
        };

        const items = construirItemsHistorial(filas, mapas);

        return NextResponse.json({
            items,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return errorToResponse(error, "[PADRE/PERFIL/AUDITORIA/GET]");
    }
}
