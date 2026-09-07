/**
 * SPEC-265 (002-PI-168) — helpers compartidos para scripts de limpieza.
 * AuditLog usa LOGS_MANTENIMIENTO_PURGA (existente, SPEC-193) con metadatos.tipo
 * como discriminador para respetar el candado "cero migraciones".
 */
import type { PrismaClient, Prisma } from "@prisma/client";

export type TipoPurga = "colegio" | "padre" | "reporte" | "simulacion" | "reset_piloto" | "purga_total";

export interface ArgsBase {
    confirm: boolean;
    motivo: string;
}

export function parseArgs(argv: string[]): Record<string, string | boolean> {
    const args: Record<string, string | boolean> = {};
    for (const raw of argv.slice(2)) {
        if (!raw.startsWith("--")) continue;
        const [k, v] = raw.slice(2).split("=");
        if (!k) continue;
        args[k] = v === undefined ? true : v;
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

/**
 * SPEC-578 (D-113, 2026-09-07) — regla única de la purga:
 *   PRESERVAR = configuración/seed del producto · BORRAR = dato de prueba.
 * La lista anterior «evidencia viva» (RPT-1RR278/RPT-2JFULR/RPT-FA1C23, D-001 §5)
 * queda ANULADA: D-113 ordena borrar también esos 3 reportes. Ver
 * scripts/limpieza/CLASIFICACION-PURGA.md (contrato completo, 111 modelos).
 */
export const PRESERVA_SIEMPRE = {
    /** Buzones que NUNCA se borran. */
    usuarios: ["soporte@innovadataco.com"],
    /**
     * Modelos que NUNCA se borran (config/seed). La purga total compara sus
     * conteos antes/después y TIRA DEL PROCESO si alguno se movió.
     * FuenteReporte se RECLASIFICÓ como dato (por-reporte) y salió de la lista.
     */
    modelos: [
        "ParametroSistema",
        "Plan",
        "NotificacionPlantilla",
        "NotificacionRegla",
        "Pais",
        "Departamento",
        "Ciudad",
        "Plataforma",
        "TipoDocumento",
        "ModuloPermisible",
        "PermisoModulo",
        "GuiaAccionCategoria",
        "ReglaRecomendacion",
        "DatasetEntrenamiento",
        "EmbeddingDataset",
        "AuditLog",
    ],
} as const;

/**
 * Compatibilidad con importadores históricos. DEPRECATED: usar PRESERVA_SIEMPRE.
 * `reportesExcluidos` queda vacío por D-113 (los 3 reportes evidencia se borran).
 */
export const PRESERVADOS = {
    usuarios: PRESERVA_SIEMPRE.usuarios,
    reportesExcluidos: [] as string[],
    tablas: [...PRESERVA_SIEMPRE.modelos],
} as const;

/**
 * SPEC-578 — validación pura de los flags de reset-piloto (testeable sin BD).
 * Reglas: --confirm obligatorio en todos los modos; --backup y
 * --backup-ya-tomado son mutuamente excluyentes y uno de los dos es obligatorio.
 */
export interface FlagsResetPiloto {
    backup: string;
    backupYaTomado: string | null;
    purgaTotal: boolean;
    soloSembrado: boolean;
}

export function validarFlagsResetPiloto(args: Record<string, string | boolean>): FlagsResetPiloto {
    if (args.confirm !== true) {
        throw new Error("[reset-piloto] Falta --confirm (obligatorio en todos los modos)");
    }
    const backup = typeof args.backup === "string" ? args.backup : "";
    const backupYaTomado = typeof args["backup-ya-tomado"] === "string" ? args["backup-ya-tomado"] : "";
    if (backup && backupYaTomado) {
        throw new Error("[reset-piloto] --backup y --backup-ya-tomado son mutuamente excluyentes");
    }
    if (!backup && !backupYaTomado) {
        throw new Error("[reset-piloto] Falta --backup=<ruta.sql> o --backup-ya-tomado=<ruta.sql>");
    }
    return {
        backup,
        backupYaTomado: backupYaTomado || null,
        purgaTotal: args["purga-total"] === true,
        soloSembrado: args["solo-sembrado"] === true,
    };
}

export function log(prefix: string, msg: string): void {
    console.log(`[limpieza/${prefix}] ${msg}`);
}

export async function ejecutarCierre(prisma: PrismaClient): Promise<void> {
    await prisma.$disconnect();
}
