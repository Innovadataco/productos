/**
 * SPEC-344 (A-69 · Fase C1) — Deriva el paso pendiente del camino del colegio.
 *
 * REGLA DE DISEÑO (misma que estado.ts del padre, línea 2-17): el progreso NO
 * se guarda en ninguna columna. Se calcula, cada vez, desde los hechos que ya
 * existen: el consentimiento del colegio, los datos del rector, la suscripción,
 * los profesores activos, los cursos activos y los estudiantes activos.
 *
 * Por qué. Una columna "paso alcanzado" es una segunda fuente de verdad que se
 * desincroniza de los hechos (I-211/I-222/I-224/I-227). Derivándolo, el camino
 * se sostiene solo: si el rector inactiva su único curso activo, vuelve al
 * Paso 4 sin que nadie tenga que revertir una bandera. Precedente vivo:
 * `OnboardingColegio.pasoActual` — apagado por esta misma spec.
 *
 * Corre en Node (toca Prisma). NUNCA se importa desde `middleware.ts` (Edge):
 * el middleware lee el resultado ya firmado dentro de la cookie `sesion_estado`.
 */
import { prisma } from "@/lib/prisma";
import { requiereConsentimientoActual } from "@/lib/consentimiento/guard";
import type { PasoPendienteColegio } from "@/lib/camino/pasos-colegio";

/**
 * Campos del rector que el Paso 1 exige (mockup A-69 v3 · momento 1.2). El
 * rector persiste en `Usuario` (patrón A-67); `Colegio.representanteLegal*`
 * refleja para consistencia con el resto del sistema, pero la fuente de la
 * validación es esta lista sobre `Usuario`.
 */
const CAMPOS_RECTOR_OBLIGATORIOS = [
    "nombre",
    "apellidos",
    "documentoTipo",
    "documentoNumero",
    "telefono",
] as const;

function estaVacio(valor: string | null | undefined): boolean {
    return valor === null || valor === undefined || valor.trim() === "";
}

/**
 * Devuelve el primer paso incumplido del colegio, o `null` si el camino está
 * terminado.
 *
 * Solo tiene sentido para el rol SCHOOL_ADMIN. Los demás roles no recorren
 * este camino; el emisor de la cookie ni siquiera llama a esta función.
 */
export async function derivarPasoPendienteColegio(
    usuarioId: string
): Promise<PasoPendienteColegio> {
    // Cargamos el rector y su colegio en una sola query. Sin colegio asociado
    // (edge case: SCHOOL_ADMIN sin fila colegio, no debería pasar en producción
    // pero conviene ser tolerante) se lo tratamos como "sin datos": Paso 1.
    const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: {
            nombre: true,
            apellidos: true,
            documentoTipo: true,
            documentoNumero: true,
            telefono: true,
            colegioId: true,
        },
    });
    if (!usuario) return "rector";
    if (!usuario.colegioId) return "rector";

    // Paso 1 · Rector. Reutiliza el guardián de consentimiento ya existente
    // (SPEC-241 / SPEC-343 para el convenio institucional). Una sola definición
    // de "consentimiento vigente" en el sistema.
    if (await requiereConsentimientoActual(usuarioId)) return "rector";
    if (CAMPOS_RECTOR_OBLIGATORIOS.some((campo) => estaVacio(usuario[campo]))) return "rector";

    // Paso 2 · Plan. Cualquier suscripción del colegio cuenta: freemium activada
    // o pagada `PENDIENTE_AUTORIZACION` (regla heredada A-67). El puente D2 se
    // encarga de escribir Colegio.finServicio con la ventana correspondiente.
    const suscripciones = await prisma.suscripcion.count({
        where: { colegioId: usuario.colegioId },
    });
    if (suscripciones === 0) return "plan";

    // Paso 3 · Profesores. Al menos uno ACTIVO — un inactivo no cuenta (el rector
    // lo apagó, no lo está gestionando).
    const profesoresActivos = await prisma.profesor.count({
        where: { colegioId: usuario.colegioId, estado: "activo" },
    });
    if (profesoresActivos === 0) return "profesores";

    // Paso 4 · Cursos. Al menos uno ACTIVO. Los 11 sembrados por
    // `crearCursosPorDefecto` cumplen desde el arranque, pero si el rector los
    // inactiva todos vuelve acá — el camino se sostiene, no se gana.
    const cursosActivos = await prisma.curso.count({
        where: { colegioId: usuario.colegioId, estado: "activo" },
    });
    if (cursosActivos === 0) return "cursos";

    // Paso 5 · Estudiantes. Al menos uno ACTIVO en cualquier curso del colegio.
    const estudiantesActivos = await prisma.estudiante.count({
        where: { colegioId: usuario.colegioId, estado: "activo" },
    });
    if (estudiantesActivos === 0) return "estudiantes";

    return null;
}
