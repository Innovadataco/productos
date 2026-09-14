import type { EstadoPerfilProfesional } from "@prisma/client";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { estaHabilitado } from "./vigencia";

export interface HabilitacionProfesional {
    /** Estado del perfil — para el menú por estado (SPEC-691, Dev 2). */
    estado: EstadoPerfilProfesional;
    /** «Habilitado AHORA» para operar: estado ACTIVO + verificación aprobada vigente. */
    habilitado: boolean;
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
    const perfil = await new PerfilProfesionalRepository().habilitacionPorUsuarioId(usuarioId);
    if (!perfil) return null;
    return { estado: perfil.estado, habilitado: estaHabilitado(perfil, perfil.verificaciones, ahora) };
}
