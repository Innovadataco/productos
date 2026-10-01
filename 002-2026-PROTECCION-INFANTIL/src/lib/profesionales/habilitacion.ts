import type { EstadoPerfilProfesional } from "@prisma/client";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { estaHabilitado } from "./vigencia";

export interface HabilitacionProfesional {
    /** Estado del perfil — para el menú por estado (SPEC-691, Dev 2). */
    estado: EstadoPerfilProfesional;
    /** «Habilitado AHORA» para operar («puede usar el área profesional»): ACTIVO + verificación interna vigente.
     *  SPEC-790: el REPS NO lo toca — para no encerrar al profesional fuera de su propio panel. */
    habilitado: boolean;
    /**
     * SPEC-790 · «Al día en el REPS» — la mitad REPS de «ofrecible» (puede ofrecerse a las familias).
     * SEPARADO de `habilitado`: un profesional puede estar `habilitado` (sigue entrando) y `repsAlDia=false`
     * (fuera de la oferta). El aviso «seguís entrando pero estás fuera de la oferta» es `habilitado ∧ ¬repsAlDia`.
     * NO lo mira ninguna compuerta operativa (eso cerraría el acceso); es señal para la superficie del profesional.
     */
    repsAlDia: boolean;
}

/**
 * SPEC-690 (I-414) · La habilitación del profesional, calculada EN EL SERVIDOR y
 * CONTRA LA BASE en cada petición — nunca desde una marca en la cookie: un
 * profesional SUSPENDIDO con sesión válida tiene que recibir su estado real en la
 * llamada siguiente, no el que tenía cuando inició sesión.
 *
 * Fuente única: `estaHabilitado` (`vigencia.ts`) — estado ACTIVO + verificación
 * aprobada vigente. La consumen `/api/me` (menú por estado, SPEC-691) y la
 * compuerta de las rutas operativas (SPEC-690-B). `null` = el usuario no tiene
 * perfil profesional (no debería para rol PROFESIONAL, pero se trata como
 * NO habilitado río abajo).
 */
export async function obtenerHabilitacionProfesional(
    usuarioId: string,
    ahora: Date = new Date(),
): Promise<HabilitacionProfesional | null> {
    const repo = new PerfilProfesionalRepository();
    const perfil = await repo.habilitacionPorUsuarioId(usuarioId);
    if (!perfil) return null;
    // `habilitado` (área profesional) y `repsAlDia` (oferta a las familias) son EJES SEPARADOS: se computan
    // aparte y ninguna compuerta operativa mira el segundo.
    const repsAlDia = await repo.repsAlDia(perfil.id, ahora);
    return { estado: perfil.estado, habilitado: estaHabilitado(perfil, perfil.verificaciones, ahora), repsAlDia };
}

/**
 * SPEC-690-B · LA COMPUERTA de las RUTAS de API. Exige que el profesional esté
 * HABILITADO para operar, o lanza **403** (NO redirige). Devuelve la habilitación
 * para que la ruta operativa obtenga su contexto SOLO pasando por acá (imposibilidad
 * estructural: no hay «operar» sin la habilitación al lado). Computa contra la base en
 * cada petición — un SUSPENDIDO con sesión válida recibe 403 en la llamada siguiente.
 *
 * Adaptador HERMANO de la guardia de PÁGINAS `exigirProfesionalHabilitado`
 * (`guardia-habilitado.ts`, SPEC-691/Dev 2), que **redirige** al portero. Mismo NÚCLEO
 * —`obtenerHabilitacionProfesional`—, distinta conducta según la superficie: la página
 * redirige, la API responde 403. Nombres distintos a propósito, para que nadie importe
 * el equivocado.
 *
 * Un candado de conducta derivado del árbol exige que TODA ruta operativa del profesional
 * pase por acá (exige la LLAMADA, no el import); una ruta operativa nueva sin la compuerta
 * lo pone rojo.
 */
export async function exigirProfesionalHabilitadoApi(
    usuarioId: string,
    ahora: Date = new Date(),
): Promise<HabilitacionProfesional> {
    const hab = await obtenerHabilitacionProfesional(usuarioId, ahora);
    if (!hab || !hab.habilitado) {
        throw new AppError(
            "Su perfil no está habilitado para esta acción. Revise el estado de su verificación.",
            ERROR_CODES.FORBIDDEN,
            403,
        );
    }
    return hab;
}
