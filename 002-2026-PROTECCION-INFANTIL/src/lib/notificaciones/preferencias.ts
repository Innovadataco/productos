/**
 * SPEC-203 (002-PI-100): helpers de preferencias de notificación del usuario final.
 *
 * Lectura y escritura de NotificacionPreferencia, siempre respetando la bandera
 * `obligatoria` de NotificacionRegla (transaccionales no se pueden apagar).
 */

import type { CanalNotificacion } from "@prisma/client";
import { NotificacionReglaRepository } from "@/lib/dal/repositories/notificacion-regla";
import { NotificacionPreferenciaRepository } from "@/lib/dal/repositories/notificacion-preferencia";

const repoRegla = new NotificacionReglaRepository();
const repoPreferencia = new NotificacionPreferenciaRepository();

export type PreferenciaUsuarioDto = {
    evento: string;
    canal: CanalNotificacion;
    eventoRegla: string;
    obligatoria: boolean;
    habilitado: boolean;
};

export type PreferenciasAgrupadasDto = {
    evento: string;
    canales: PreferenciaUsuarioDto[];
};

/**
 * Devuelve las reglas activas aplicables al rol del usuario con la preferencia
 * efectiva actual. Sin fila de preferencia se asume habilitado (opt-out).
 */
export async function obtenerPreferenciasUsuario(
    usuarioId: string,
    rol: string
): Promise<PreferenciasAgrupadasDto[]> {
    const reglas = await repoRegla.listarActivas();
    const reglasRol = reglas.filter((r) => r.rol === rol);

    const preferencias = await repoPreferencia.listarPorUsuario(usuarioId);
    const prefMap = new Map(preferencias.map((p) => [p.eventoRegla, p.habilitado]));

    const porEvento = new Map<string, PreferenciaUsuarioDto[]>();
    for (const regla of reglasRol) {
        const eventoRegla = `${regla.evento}.${regla.canal.toLowerCase()}`;
        const dto: PreferenciaUsuarioDto = {
            evento: regla.evento,
            canal: regla.canal,
            eventoRegla,
            obligatoria: regla.obligatoria,
            habilitado: regla.obligatoria ? true : (prefMap.get(eventoRegla) ?? true),
        };
        const lista = porEvento.get(regla.evento) ?? [];
        lista.push(dto);
        porEvento.set(regla.evento, lista);
    }

    return Array.from(porEvento.entries())
        .map(([evento, canales]) => ({ evento, canales }))
        .sort((a, b) => a.evento.localeCompare(b.evento));
}

export type ResultadoActualizarPreferencia =
    | { ok: true }
    | { ok: false; error: "regla_obligatoria" | "regla_inexistente" };

/**
 * Actualiza la preferencia de un usuario para `evento.canal`.
 * Si la regla es obligatoria o no existe, devuelve el código de error sin tocar BD.
 */
export async function actualizarPreferencia(
    usuarioId: string,
    rol: string,
    eventoRegla: string,
    habilitado: boolean
): Promise<ResultadoActualizarPreferencia> {
    const partes = eventoRegla.split(".");
    const canal = partes.pop()?.toUpperCase() as CanalNotificacion | undefined;
    const evento = partes.join(".");

    if (!evento || !canal) {
        return { ok: false, error: "regla_inexistente" };
    }

    const regla = await repoRegla.findByEventoRolCanal(evento, rol, canal);
    // La búsqueda por (evento, rol, canal) puede devolver inactiva; solo activa importa.
    if (!regla || !regla.activa) {
        return { ok: false, error: "regla_inexistente" };
    }

    if (regla.obligatoria) {
        return { ok: false, error: "regla_obligatoria" };
    }

    await repoPreferencia.actualizar(usuarioId, eventoRegla, habilitado);
    return { ok: true };
}
