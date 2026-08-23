/**
 * SPEC-203 (002-PI-100): bandeja in-app del usuario final.
 *
 * Renderiza las plantillas Markdown de cada envío para mostrar título y mensaje
 * sin exponer variables ni PII al cliente más allá de lo que la plantilla decida.
 */

import { NotificacionRepository } from "@/lib/dal/repositories/notificacion";
import { NotificacionPlantillaRepository } from "@/lib/dal/repositories/notificacion-plantilla";
import { renderizarPlantilla } from "@/lib/notificaciones/renderer";
import { clampPage, clampPageSize } from "@/lib/pagination";
import { formatoFechaHoraBogota } from "@/lib/fechas/formato-bogota";

export type NotificacionUsuarioItem = {
    id: string;
    evento: string;
    titulo: string;
    mensaje: string;
    estado: string;
    leidaEn: string | null;
    creadoEn: string;
};

export type BandejaUsuarioResult = {
    items: NotificacionUsuarioItem[];
    page: number;
    pageSize: number;
    total: number;
};

export class NotificacionUsuarioBandejaService {
    constructor(
        private readonly repoNotif = new NotificacionRepository(),
        private readonly repoPlantilla = new NotificacionPlantillaRepository()
    ) {}

    async listar(
        usuarioId: string,
        rawPage: number | string | null,
        rawPageSize: number | string | null,
        soloNoLeidas?: boolean
    ): Promise<BandejaUsuarioResult> {
        const page = clampPage(rawPage);
        const pageSize = clampPageSize(rawPageSize);
        const skip = (page - 1) * pageSize;

        const { items, total } = await this.repoNotif.listarPorDestinatario(
            usuarioId,
            { skip, take: pageSize },
            soloNoLeidas
        );

        const renderizados = await Promise.all(
            items.map(async (n) => {
                const plantilla = await this.repoPlantilla.findByClaveYCanal(n.plantillaClave, n.canal);
                const vars = (n.variables as Record<string, unknown>) ?? {};
                const renderizado = plantilla
                    ? renderizarPlantilla(plantilla.cuerpoMarkdown, plantilla.asunto, vars)
                    : { asunto: null, cuerpo: n.evento };
                return {
                    id: n.id,
                    evento: n.evento,
                    titulo: renderizado.asunto ?? n.evento,
                    mensaje: renderizado.cuerpo,
                    estado: n.estado,
                    leidaEn: n.openedAt ? formatoFechaHoraBogota(n.openedAt) : null,
                    creadoEn: formatoFechaHoraBogota(n.createdAt),
                };
            })
        );

        return { items: renderizados, page, pageSize, total };
    }

    async contarNoLeidas(usuarioId: string): Promise<number> {
        return this.repoNotif.contarNoLeidasPorDestinatario(usuarioId);
    }

    async marcarLeida(usuarioId: string, id: string): Promise<number> {
        return this.repoNotif.marcarAbiertaPorDestinatario(id, usuarioId);
    }

    async marcarTodasLeidas(usuarioId: string): Promise<number> {
        return this.repoNotif.marcarTodasAbiertasPorDestinatario(usuarioId);
    }
}
