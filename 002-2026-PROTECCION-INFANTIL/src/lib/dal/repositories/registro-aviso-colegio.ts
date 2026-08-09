/**
 * SPEC-149 (FR-001): repositorio de RegistroAvisoColegio — LA idempotencia por
 * constraint @@unique([colegioId, tipoEvento, entidadId, dia]): un mismo
 * evento/entidad/día = UNA fila; el duplicado es no-op (P2002 → devuelve la
 * fila existente, nunca error). ENVIADO solo se marca tras el 200 del proveedor;
 * FALLIDO no consume la idempotencia (pg-boss reintenta y luego actualiza).
 * Tenant obligatorio por construcción (toda firma exige `colegioId`).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";
import type { TipoEventoAvisoColegio } from "./preferencia-alerta-colegio";

/** Estados del registro (columna String con valores cerrados). */
export type EstadoRegistroAviso = "ENVIADO" | "OMITIDO" | "PENDIENTE_DIGEST" | "FALLIDO";

export interface ClaveRegistroAviso {
    colegioId: string;
    tipoEvento: TipoEventoAvisoColegio;
    entidadId: string;
    dia: Date;
}

export class RegistroAvisoColegioRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Registro por clave exacta (la única de idempotencia). Null si nunca se procesó. */
    buscar(clave: ClaveRegistroAviso) {
        return this.db.registroAvisoColegio.findUnique({
            where: {
                colegioId_tipoEvento_entidadId_dia: {
                    colegioId: clave.colegioId,
                    tipoEvento: clave.tipoEvento,
                    entidadId: clave.entidadId,
                    dia: clave.dia,
                },
            },
        });
    }

    /**
     * Inserta el registro si la clave no existe; si existe (P2002) es no-op y
     * devuelve la fila existente. `creado=false` ≡ el evento ya fue procesado hoy.
     */
    async registrarSiAusente(
        clave: ClaveRegistroAviso,
        estado: EstadoRegistroAviso,
        detalle?: string
    ): Promise<{ creado: boolean; registro: { id: string; estado: string } }> {
        try {
            const registro = await this.db.registroAvisoColegio.create({
                data: { ...clave, estado, detalle: detalle ?? null },
                select: { id: true, estado: true },
            });
            return { creado: true, registro };
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                const existente = await this.buscar(clave);
                if (!existente) throw error;
                return { creado: false, registro: { id: existente.id, estado: existente.estado } };
            }
            throw error;
        }
    }

    /** Actualiza estado/detalle de una fila existente (FALLIDO→ENVIADO, digest→ENVIADO). */
    actualizarEstado(id: string, estado: EstadoRegistroAviso, detalle?: string) {
        return this.db.registroAvisoColegio.update({
            where: { id },
            data: { estado, ...(detalle !== undefined ? { detalle } : {}) },
        });
    }

    /**
     * Emails de aviso YA enviados hoy al colegio (base del tope diario). El
     * RESUMEN_SEMANAL no cuenta: es semanal y programado, no ruido del día.
     */
    contarEnviadosDelDia(colegioId: string, dia: Date): Promise<number> {
        return this.db.registroAvisoColegio.count({
            where: {
                colegioId,
                dia,
                estado: "ENVIADO",
                tipoEvento: { not: "RESUMEN_SEMANAL" },
            },
        });
    }

    /** Eventos que el tope diario mandó al digest y aún no salen en un resumen. */
    pendientesDigest(colegioId: string) {
        return this.db.registroAvisoColegio.findMany({
            where: { colegioId, estado: "PENDIENTE_DIGEST" },
            orderBy: [{ dia: "asc" }, { creadoEn: "asc" }],
        });
    }

    /** Marca los pendientes ya incluidos en un resumen semanal (entregados). */
    marcarDigestComoEnviados(colegioId: string, ids: string[], detalle: string) {
        return this.db.registroAvisoColegio.updateMany({
            where: { colegioId, id: { in: ids }, estado: "PENDIENTE_DIGEST" },
            data: { estado: "ENVIADO", detalle },
        });
    }

    /**
     * SPEC-159 (FR-003): registros de aviso de UNA entidad del colegio (p. ej.
     * el reporte de una alerta) — fuente del hito "avisado" de la línea de
     * tiempo: ENVIADO es la verdad del envío; OMITIDO / PENDIENTE_DIGEST /
     * FALLIDO se muestran con su estado honesto, nunca un check falso.
     */
    porEntidad(colegioId: string, entidadId: string) {
        return this.db.registroAvisoColegio.findMany({
            where: { colegioId, entidadId },
            orderBy: { creadoEn: "asc" },
        });
    }
}
