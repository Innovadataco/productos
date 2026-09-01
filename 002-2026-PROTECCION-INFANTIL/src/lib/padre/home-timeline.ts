/**
 * SPEC-309 (A-50): timeline propio de eventos recientes para el home del padre.
 * No importa servicios de SPEC-306; delega las consultas a
 * src/lib/dal/services/padre-home.ts (Q-3).
 */
import { obtenerEventosTimeline } from "@/lib/dal/services/padre-home";

export type TimelineHomeItem = {
    id: string;
    fechaEvento: Date;
    texto: string;
    categoria: string | null;
    contactoEtiqueta: string | null;
    // SPEC-340: puede no existir aún (el expediente nace por el botón).
    expedienteId: string | null;
};

export async function obtenerTimelineHome(usuarioId: string, limite = 5): Promise<TimelineHomeItem[]> {
    return obtenerEventosTimeline(usuarioId, limite);
}
