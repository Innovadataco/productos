/**
 * SPEC-265 (002-PI-168) — helpers compartidos para scripts de limpieza.
 * AuditLog usa LOGS_MANTENIMIENTO_PURGA (existente, SPEC-193) con metadatos.tipo
 * como discriminador para respetar el candado "cero migraciones".
 */
import type { PrismaClient, Prisma } from "@prisma/client";

export type TipoPurga = "colegio" | "padre" | "reporte" | "simulacion" | "reset_piloto";

export interface ArgsBase {
    confirm: boolean;
    motivo: string;
}

/**
 * Parsea `--k=v` y `--k` (booleano). ABORTA (throw) ante CUALQUIER flag no reconocido — antes
 * de tocar nada. Un script DESTRUCTIVO que traga en silencio una bandera que no entiende es una
 * trampa: `reset-piloto --purga-total` con el flag ignorado correría el reset NORMAL y creeríamos
 * la base vacía con datos adentro (CEO 06-09). Por eso `flagsPermitidos` es OBLIGATORIO: ningún
 * script de limpieza puede volver al modo que ignora en silencio.
 */
export function parseArgs(argv: string[], flagsPermitidos: readonly string[]): Record<string, string | boolean> {
    const permitidos = new Set(flagsPermitidos);
    const args: Record<string, string | boolean> = {};
    const desconocidos: string[] = [];
    for (const raw of argv.slice(2)) {
        if (!raw.startsWith("--")) continue;
        const [k, v] = raw.slice(2).split("=");
        if (!k) continue;
        if (!permitidos.has(k)) {
            desconocidos.push(k);
            continue;
        }
        args[k] = v === undefined ? true : v;
    }
    if (desconocidos.length > 0) {
        throw new Error(
            `[limpieza] Flag(s) no reconocido(s): ${desconocidos.map((d) => `--${d}`).join(", ")}. ` +
                `Permitidos: ${[...permitidos].map((p) => `--${p}`).join(", ")}. ` +
                "ABORTA sin borrar nada — un flag ignorado en un script destructivo es una trampa.",
        );
    }
    return args;
}

export function requerirMotivo(motivo: string | undefined): string {
    if (!motivo || motivo.length < 20) {
        throw new Error(
            "[limpieza] Falta --motivo=<texto>. Mínimo 20 caracteres. Ejemplo: --motivo=\"limpieza de piloto agosto 2026\""
        );
    }
    return motivo;
}

export async function registrarAuditoria(
    tx: Prisma.TransactionClient,
    tipo: TipoPurga,
    motivo: string,
    filasBorradas: number,
    idsAfectados: string[],
    ejecutadoPorId?: string,
): Promise<void> {
    await tx.auditLog.create({
        data: {
            accion: "LOGS_MANTENIMIENTO_PURGA",
            tipoRecurso: "PurgaData",
            usuarioId: ejecutadoPorId ?? null,
            ipAddress: "script",
            userAgent: `scripts/limpieza/${tipo}`,
            metadatos: {
                tipo,
                motivo,
                filasBorradas,
                idsAfectados,
            } satisfies Prisma.InputJsonValue,
        },
    });
}

/**
 * SPEC-508 · para el sangrado del P1-A de la auditoría del modelo. Borrar un
 * `Usuario` con filas en `AuditConsentimiento` dispara el `onDelete: Cascade` y
 * destruye la evidencia legal del consentimiento (Ley 1581) SIN dejar rastro —
 * ni siquiera aparece en el dry-run. Hasta la migración P1-A (que cambia el FK a
 * `Restrict` y archiva en una `ConstanciaConsentimiento` inmutable), NINGÚN
 * camino de borrado puede tocar un usuario con consentimiento: se NIEGA en voz alta.
 *
 * No se «archiva» en `AuditLog.metadatos`: esa columna se replica a `bi_replica`
 * y meter ahí el `documentoHash` abriría una fuga de PII (otro hallazgo de la
 * misma auditoría). Por eso el stop-gap es negarse, no copiar.
 */
export async function contarConsentimientos(
    client: Pick<PrismaClient, "auditConsentimiento">,
    usuarioIds: string[],
): Promise<number> {
    if (usuarioIds.length === 0) return 0;
    return client.auditConsentimiento.count({ where: { usuarioId: { in: usuarioIds } } });
}

export async function bloquearSiHayConsentimiento(
    client: Pick<PrismaClient, "auditConsentimiento">,
    usuarioIds: string[],
    contexto: string,
): Promise<void> {
    const n = await contarConsentimientos(client, usuarioIds);
    if (n > 0) {
        throw new Error(
            `[limpieza] BORRADO BLOQUEADO (${contexto}): ${n} constancia(s) de AuditConsentimiento se ` +
                "destruirían por el cascade (evidencia legal, Ley 1581). Hasta la migración P1-A " +
                "(ConstanciaConsentimiento inmutable) este borrado se NIEGA. Preservá la evidencia antes.",
        );
    }
}

export const PRESERVADOS = {
    usuarios: ["soporte@innovadataco.com"],
    // Reportes que NO borra reset-piloto (D-001 §5, evidencia viva I-105/I-100/I-113/I-114/I-121).
    reportesExcluidos: ["RPT-1RR278", "RPT-2JFULR", "RPT-FA1C23"],
    // Tablas que NUNCA se tocan (seed permanente).
    tablas: [
        "ParametroSistema",
        "Plan",
        "notificacion_reglas",
        "notificacion_plantillas",
        "Pais",
        "Departamento",
        "Ciudad",
        "Plataforma",
        "ModuloPermisible",
        "GuiaAccionCategoria",
        "reglas_recomendacion",
        "FuenteReporte",
        "DatasetEntrenamiento",
        "EmbeddingDataset",
        "AuditLog",
    ],
} as const;

export function log(prefix: string, msg: string): void {
    console.log(`[limpieza/${prefix}] ${msg}`);
}

export async function ejecutarCierre(prisma: PrismaClient): Promise<void> {
    await prisma.$disconnect();
}
