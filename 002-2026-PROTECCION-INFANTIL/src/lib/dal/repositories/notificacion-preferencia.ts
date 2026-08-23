/**
 * SPEC-201 (BRIEF §5.4): repositorio de NotificacionPreferencia.
 */
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";
import type { Prisma } from "@prisma/client";

export class NotificacionPreferenciaRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findByUsuarioYEvento(usuarioId: string, eventoRegla: string) {
        return this.db.notificacionPreferencia.findUnique({
            where: { usuarioId_eventoRegla: { usuarioId, eventoRegla } },
        });
    }

    /**
     * Indica si el usuario tiene habilitada la regla. Si no existe preferencia,
     * el default es habilitado (opt-out: hay que desactivar explícitamente).
     * Las reglas obligatorias siempre devuelven true.
     */
    async estaHabilitada(usuarioId: string, eventoRegla: string, obligatoria: boolean): Promise<boolean> {
        if (obligatoria) return true;
        const pref = await this.findByUsuarioYEvento(usuarioId, eventoRegla);
        return pref?.habilitado ?? true;
    }

    crear(usuarioId: string, eventoRegla: string, habilitado = true) {
        return this.db.notificacionPreferencia.create({
            data: {
                usuarioId,
                eventoRegla,
                habilitado,
            },
        });
    }

    actualizar(usuarioId: string, eventoRegla: string, habilitado: boolean) {
        return this.db.notificacionPreferencia.upsert({
            where: { usuarioId_eventoRegla: { usuarioId, eventoRegla } },
            update: { habilitado },
            create: { usuarioId, eventoRegla, habilitado },
        });
    }

    listarPorUsuario(usuarioId: string) {
        return this.db.notificacionPreferencia.findMany({ where: { usuarioId } });
    }
}
