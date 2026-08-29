/**
 * SPEC-053 (US3, módulo Alertas): AlertaService.
 * Suscripciones de alerta por email: listado del usuario, suscripción (solo
 * identificadores visibles públicamente) y cancelación (dueño o admin).
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { AlertaSuscripcionRepository } from "../repositories/alerta-suscripcion";
import { PlataformaRepository } from "../repositories/plataforma";
import { IdentificadorReportadoRepository } from "../repositories/identificador-reportado";

export type ResultadoSuscripcion =
    | { ok: true; suscripcion: Awaited<ReturnType<AlertaSuscripcionRepository["upsertActivar"]>> }
    | { ok: false; tipo: "plataforma_invalida" | "no_visible" };

export type ResultadoCancelacion =
    | { ok: true }
    | { ok: false; tipo: "no_encontrada" | "prohibido" };

export class AlertaService {
    private readonly suscripciones: AlertaSuscripcionRepository;
    private readonly plataformas: PlataformaRepository;
    private readonly identificadores: IdentificadorReportadoRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.suscripciones = new AlertaSuscripcionRepository(tx);
        this.plataformas = new PlataformaRepository(tx);
        this.identificadores = new IdentificadorReportadoRepository(tx);
    }

    /** GET /api/alertas — suscripciones activas del usuario. */
    listar(usuarioId: string) {
        return this.suscripciones.findActivasPorUsuario(usuarioId);
    }

    /** POST /api/alertas/suscribir — crea o reactiva (solo identificadores públicos). */
    async suscribir(input: { usuarioId: string; identificador: string; plataformaId: string }): Promise<ResultadoSuscripcion> {
        const plataforma = await this.plataformas.findById(input.plataformaId);
        if (!plataforma) {
            return { ok: false, tipo: "plataforma_invalida" };
        }

        // El identificador debe existir y ser visible públicamente para suscribirse.
        const identificadorReportado = await this.identificadores.findByPar(input.identificador, input.plataformaId);
        if (!identificadorReportado || !identificadorReportado.esVisiblePublicamente) {
            return { ok: false, tipo: "no_visible" };
        }

        const suscripcion = await this.suscripciones.upsertActivar(input);
        return { ok: true, suscripcion };
    }

    /** DELETE /api/alertas/:id — desactiva (dueño o admin). */
    async cancelar(id: string, usuarioId: string, rol: string): Promise<ResultadoCancelacion> {
        const suscripcion = await this.suscripciones.findById(id);
        if (!suscripcion) {
            return { ok: false, tipo: "no_encontrada" };
        }
        if (suscripcion.usuarioId !== usuarioId && rol !== "ADMIN") {
            return { ok: false, tipo: "prohibido" };
        }

        await this.suscripciones.desactivar(id);
        return { ok: true };
    }
}
