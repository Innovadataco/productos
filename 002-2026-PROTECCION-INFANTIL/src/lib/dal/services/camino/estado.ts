/**
 * SPEC-339 (A-67 · Fase 1) — Deriva el paso pendiente del camino del padre.
 *
 * REGLA DE DISEÑO: el progreso NO se guarda en ninguna columna. Se calcula, cada
 * vez, desde los hechos que ya existen en la base: el consentimiento firmado, el
 * perfil, los menores y la suscripción.
 *
 * Por qué. Una columna "paso alcanzado" es una segunda fuente de verdad que se
 * desincroniza de los hechos, que es exactamente la familia de defectos que ya
 * costó cuatro incidencias (I-211 / I-222 / I-224 / I-227: cookie o bandera
 * stale contra el estado real). Derivándolo, el camino se sostiene solo: si el
 * padre inactiva su único menor, vuelve al Paso 3 sin que nadie tenga que
 * acordarse de revertir una bandera.
 *
 * Corre en Node (toca Prisma). NUNCA se importa desde `middleware.ts` (Edge):
 * el middleware lee el resultado ya firmado dentro de la cookie `sesion_estado`.
 */
import { prisma } from "@/lib/prisma";
import { requiereConsentimientoActual } from "@/lib/consentimiento/guard";
import type { PasoPendiente } from "@/lib/camino/pasos";

/**
 * Campos del perfil que el Paso 2 exige (brief §2.3, definidos por Jelkin).
 * `fechaNacimiento` NO está: existe en la base pero dejó de pedirse (decisión
 * CEO D-2, 31-08-2026). No se borró ningún dato.
 */
const CAMPOS_PERFIL_OBLIGATORIOS = [
    "nombre",
    "apellidos",
    "documentoTipo",
    "documentoNumero",
    "telefono",
    "paisId",
    "ciudadId",
] as const;

function estaVacio(valor: string | null | undefined): boolean {
    return valor === null || valor === undefined || valor.trim() === "";
}

/**
 * Devuelve el primer paso incumplido, o `null` si el camino está terminado.
 *
 * Solo tiene sentido para el rol padre. Los demás roles no recorren camino; el
 * emisor de la cookie ni siquiera llama a esta función para ellos.
 */
export async function derivarPasoPendiente(usuarioId: string): Promise<PasoPendiente> {
    // Paso 1 · Permiso. Reutiliza el guardián de consentimiento ya existente
    // (SPEC-241): una sola definición de "consentimiento vigente" en el sistema.
    if (await requiereConsentimientoActual(usuarioId)) return "permiso";

    // Paso 2 · Tus datos.
    const perfil = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: {
            nombre: true,
            apellidos: true,
            documentoTipo: true,
            documentoNumero: true,
            telefono: true,
            paisId: true,
            ciudadId: true,
        },
    });
    // Sin usuario no hay camino que derivar; el guardián de sesión ya lo habrá
    // echado antes de llegar acá.
    if (!perfil) return "permiso";
    if (CAMPOS_PERFIL_OBLIGATORIOS.some((campo) => estaVacio(perfil[campo]))) return "datos";

    // Paso 3 · Tus hijos. Al menos un menor ACTIVO: uno inactivo no cuenta,
    // porque el padre lo apagó y no lo está cuidando (SPEC-339 · FR-018).
    // SPEC-339 (D-4): la ficha del menor tiene dueño propio; se acota por
    // `usuarioId`, ya no por la tabla puente `HijoPadre`.
    const menoresActivos = await prisma.hijo.count({
        where: { usuarioId, estado: "activo" },
    });
    if (menoresActivos === 0) return "hijos";

    // Paso 4 · Tu plan. Basta con que HAYA elegido un plan alguna vez: si el que
    // eligió venció, manda el guardián de vigencia y lo lleva a renovar, NO el
    // del camino. Un padre con el plan vencido no vuelve a registrarse.
    const suscripciones = await prisma.suscripcion.count({ where: { usuarioId } });
    if (suscripciones === 0) return "plan";

    return null;
}
