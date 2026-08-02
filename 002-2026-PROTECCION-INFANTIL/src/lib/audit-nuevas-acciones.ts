/**
 * SPEC-140 (F2/N-4) + SPEC-141 (N-1): acciones de auditoría NUEVAS del enum
 * `AccionAudit` (migración aditiva 20260802230000_acciones_audit_denuncia_forense_soporte).
 *
 * El cliente Prisma generado aún NO conoce estos valores (se regenera al
 * integrar): valida los enums contra su DMMF y RECHAZA escribir — e incluso
 * LEER — filas con estos valores. Mientras tanto, estas acciones se escriben
 * y consultan con SQL crudo, que no pasa por esa validación.
 *
 * TODO(post-integración): cuando el cliente se regenere con el enum nuevo,
 * migrar estos accesos a `logAudit` (`src/lib/audit.ts`) y al repo
 * `AuditLogRepository`, y eliminar este módulo.
 *
 * Reglas heredadas de `logAudit`:
 * - La IP se persiste hasheada (`sha256:` + HMAC-SHA256, E-6) — mismo helper.
 * - Los metadatos NUNCA llevan contenido (ni texto de reportes, ni valores de
 *   identificadores, ni nombres de alumnos): solo claves del evento.
 */
import { prisma } from "./prisma";
import { hashConSalt } from "./anti-abuso/fuente-reporte";

export const ACCION_DENUNCIA_FORMAL_GENERADA = "DENUNCIA_FORMAL_GENERADA";
export const ACCION_EXPEDIENTE_FORENSE_EXPORTADO = "EXPEDIENTE_FORENSE_EXPORTADO";
export const ACCION_CIRCULO_CONFIANZA_ACCESO_ADMIN = "CIRCULO_CONFIANZA_ACCESO_ADMIN";
export const ACCION_COLEGIO_ROSTER_ACCESO_ADMIN = "COLEGIO_ROSTER_ACCESO_ADMIN";

export type AccionAuditNueva =
    | typeof ACCION_DENUNCIA_FORMAL_GENERADA
    | typeof ACCION_EXPEDIENTE_FORENSE_EXPORTADO
    | typeof ACCION_CIRCULO_CONFIANZA_ACCESO_ADMIN
    | typeof ACCION_COLEGIO_ROSTER_ACCESO_ADMIN;

function protegerIp(ipAddress: string): string {
    if (ipAddress === "unknown" || ipAddress === "worker" || ipAddress === "job") return ipAddress;
    if (ipAddress.startsWith("sha256:")) return ipAddress;
    return `sha256:${hashConSalt(ipAddress)}`;
}

/** Fila de auditoría leída por SQL crudo (ver cabecera del módulo). */
export interface FilaAuditNueva {
    id: string;
    accion: string;
    tipoRecurso: string;
    recursoId: string | null;
    usuarioId: string | null;
    colegioId: string | null;
    ipAddress: string;
    userAgent: string;
    metadatos: unknown;
    creadoEn: Date;
}

/**
 * Escribe el evento de auditoría de una acción nueva (SQL crudo, ver cabecera).
 * Misma forma que `logAudit`: IP hasheada, userAgent/IP con fallback "unknown".
 */
export async function logAuditNuevaAccion(params: {
    accion: AccionAuditNueva;
    tipoRecurso: string;
    recursoId?: string | undefined;
    usuarioId?: string | undefined;
    colegioId?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
    metadatos?: Record<string, unknown> | undefined;
}): Promise<void> {
    await prisma.$executeRaw`
        INSERT INTO "AuditLog"
            (id, accion, "tipoRecurso", "recursoId", "usuarioId", "colegioId", "ipAddress", "userAgent", metadatos, "creadoEn")
        VALUES (
            ${crypto.randomUUID()},
            ${params.accion}::"AccionAudit",
            ${params.tipoRecurso},
            ${params.recursoId ?? null},
            ${params.usuarioId ?? null},
            ${params.colegioId ?? null},
            ${protegerIp(params.ipAddress ?? "unknown")},
            ${params.userAgent ?? "unknown"},
            ${params.metadatos ? JSON.stringify(params.metadatos) : null}::jsonb,
            NOW()
        )
    `;
}

/** Lee eventos de una acción nueva (tests y verificaciones; SQL crudo). */
export async function findAuditNuevaAccion(
    accion: AccionAuditNueva,
    filtro: { recursoId?: string; usuarioId?: string } = {}
): Promise<FilaAuditNueva[]> {
    return prisma.$queryRaw<FilaAuditNueva[]>`
        SELECT id, accion::text AS accion, "tipoRecurso", "recursoId", "usuarioId", "colegioId",
               "ipAddress", "userAgent", metadatos, "creadoEn"
        FROM "AuditLog"
        WHERE accion::text = ${accion}
          AND (${filtro.recursoId ?? null}::text IS NULL OR "recursoId" = ${filtro.recursoId ?? null})
          AND (${filtro.usuarioId ?? null}::text IS NULL OR "usuarioId" = ${filtro.usuarioId ?? null})
        ORDER BY "creadoEn" ASC
    `;
}

/**
 * SPEC-140 (FR-008, US3): conteo agregado de denuncias formales generadas —
 * total y por mes (período `YYYY-MM`), SIN identificadores (métrica de impacto).
 */
export async function contarDenunciasFormales(): Promise<{
    total: number;
    porPeriodo: { periodo: string; total: number }[];
}> {
    const rows = await prisma.$queryRaw<{ periodo: string; total: bigint }[]>`
        SELECT TO_CHAR(DATE_TRUNC('month', "creadoEn"), 'YYYY-MM') AS periodo,
               COUNT(*)::bigint AS total
        FROM "AuditLog"
        WHERE accion::text = ${ACCION_DENUNCIA_FORMAL_GENERADA}
        GROUP BY DATE_TRUNC('month', "creadoEn")
        ORDER BY periodo ASC
    `;
    const porPeriodo = rows.map((r) => ({ periodo: r.periodo, total: Number(r.total) }));
    return { total: porPeriodo.reduce((acc, p) => acc + p.total, 0), porPeriodo };
}
