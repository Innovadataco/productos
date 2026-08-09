/**
 * SPEC-149 (FR-001): repositorio de PreferenciaAlertaColegio — tenant obligatorio
 * por construcción (toda firma exige `colegioId` y la única es colegioId+tipoEvento).
 * UNA fila por (colegio, tipoEvento): el upsert NUNCA duplica. Sin fila rigen los
 * defaults del pipeline (`src/lib/colegio/avisos.ts`).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

/** Tipos de evento de aviso (columna String con valores cerrados, como AlertaColegio.estado). */
export type TipoEventoAvisoColegio = "REPORTE_NUEVO" | "UMBRAL_CURSO" | "ESTUDIANTE_REPETIDO" | "RESUMEN_SEMANAL";

export const TIPOS_EVENTO_AVISO: TipoEventoAvisoColegio[] = [
    "REPORTE_NUEVO",
    "UMBRAL_CURSO",
    "ESTUDIANTE_REPETIDO",
    "RESUMEN_SEMANAL",
];

export interface DatosPreferenciaAviso {
    habilitado?: boolean | undefined;
    emailDestino?: string | null | undefined;
    umbral?: number | null | undefined;
    ventanaDias?: number | null | undefined;
}

export class PreferenciaAlertaColegioRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Preferencias del colegio (solo filas existentes; los defaults no se materializan). */
    listarPorColegio(colegioId: string) {
        return this.db.preferenciaAlertaColegio.findMany({
            where: { colegioId },
            orderBy: { tipoEvento: "asc" },
        });
    }

    /** Preferencia de un tipo, SIEMPRE filtrada por tenant. Null si no existe (rigen defaults). */
    obtenerPorTipo(colegioId: string, tipoEvento: TipoEventoAvisoColegio) {
        return this.db.preferenciaAlertaColegio.findUnique({
            where: { colegioId_tipoEvento: { colegioId, tipoEvento } },
        });
    }

    /**
     * Upsert por (colegio, tipoEvento): crea la fila o actualiza la existente.
     * Campo ausente ≡ no tocarlo en update; en create cae al default/null.
     */
    upsertPreferencia(colegioId: string, tipoEvento: TipoEventoAvisoColegio, datos: DatosPreferenciaAviso) {
        const update: Prisma.PreferenciaAlertaColegioUpdateInput = {
            ...(datos.habilitado !== undefined ? { habilitado: datos.habilitado } : {}),
            ...(datos.emailDestino !== undefined ? { emailDestino: datos.emailDestino } : {}),
            ...(datos.umbral !== undefined ? { umbral: datos.umbral } : {}),
            ...(datos.ventanaDias !== undefined ? { ventanaDias: datos.ventanaDias } : {}),
        };
        return this.db.preferenciaAlertaColegio.upsert({
            where: { colegioId_tipoEvento: { colegioId, tipoEvento } },
            create: {
                colegioId,
                tipoEvento,
                habilitado: datos.habilitado ?? true,
                emailDestino: datos.emailDestino ?? null,
                umbral: datos.umbral ?? null,
                ventanaDias: datos.ventanaDias ?? null,
            },
            update,
        });
    }
}
