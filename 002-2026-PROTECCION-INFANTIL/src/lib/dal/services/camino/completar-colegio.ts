/**
 * SPEC-962 — Cierre del camino guiado del colegio.
 *
 * Defecto de origen (Jelkin en prod, Colegio 41): el correo «Su cuenta está lista»
 * salía al ACEPTAR la Política (consentimiento.ts), con el camino aún en el Paso 1.
 * Ahora el correo de bienvenida del rector lo dispara el CIERRE del camino: cuando
 * el rector TERMINA los 5 pasos por primera vez.
 *
 * El progreso se SIGUE derivando de los hechos (estado-colegio.ts): esta función
 * no guarda progreso. `Colegio.bienvenidaEnviadaEn` es SOLO el pestillo de
 * idempotencia del correo (una vez por colegio), fijado por compare-and-set.
 *
 * Reglas:
 *  - La constancia del correo lleva la versión y la fecha de la ACEPTACIÓN GUARDADA
 *    (Usuario.consentimiento*), no la de «ahora»: el rector aceptó en el Paso 1 y
 *    termina más tarde.
 *  - El aviso es best-effort: un fallo al encolar NO revierte la marca ni bloquea
 *    el aterrizaje del rector en el panel (regla dura: aviso ≠ acción de negocio).
 *  - Corre en Node (toca Prisma). La invoca la server action «Terminar» del Paso 5.
 */
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { derivarPasoPendienteColegio } from "./estado-colegio";
import { enviarBienvenidaRectorFusionada } from "@/lib/email-colegio";
import type { PasoColegio } from "@/lib/camino/pasos-colegio";

const TIMEZONE_BOGOTA = "America/Bogota";

export type ResultadoCompletarColegio =
    | { estado: "pendiente"; paso: PasoColegio }
    | { estado: "completado" }
    | { estado: "ya_completado" };

/**
 * Cierra el camino del colegio del rector `usuarioId`.
 *
 *  - Si falta un paso → `{ estado: "pendiente", paso }` y NO encola nada.
 *  - Si están los 5 y es la PRIMERA vez → fija la marca y encola la bienvenida una
 *    sola vez → `{ estado: "completado" }`.
 *  - Si ya estaba completado → `{ estado: "ya_completado" }`, sin reencolar.
 *
 * El llamador (server action / página) traduce el resultado a redirect + sellado
 * de cookie. No se hace redirect aquí para que la decisión sea testeable.
 */
export async function completarCaminoColegio(usuarioId: string): Promise<ResultadoCompletarColegio> {
    const paso = await derivarPasoPendienteColegio(usuarioId);
    if (paso) return { estado: "pendiente", paso };

    const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { colegioId: true, consentimientoVersion: true, consentimientoAceptadoEn: true },
    });
    // Sin colegio el camino nunca estaría completo (derivar habría devuelto "rector");
    // defensivo: tratamos como ya cerrado para no encolar sin destinatario-colegio.
    if (!usuario?.colegioId) return { estado: "ya_completado" };

    // Compare-and-set atómico: solo el PRIMER cierre fija la marca y encola.
    // Un 2.º «Terminar» o una visita a /listo caen en count === 0 → no duplican.
    // Los colegios que ya recibieron la bienvenida al aceptar (pre-SPEC-962) llegan
    // con la marca ya sembrada por el backfill → count === 0 → tampoco reencolan.
    const marca = await prisma.colegio.updateMany({
        where: { id: usuario.colegioId, bienvenidaEnviadaEn: null },
        data: { bienvenidaEnviadaEn: new Date() },
    });
    if (marca.count === 0) return { estado: "ya_completado" };

    // Primera vez: encola la bienvenida con la constancia GUARDADA (no «ahora»).
    // Best-effort: un fallo del aviso NO revierte la marca ni bloquea el panel.
    try {
        const fechaAceptacion = usuario.consentimientoAceptadoEn
            ? formatInTimeZone(usuario.consentimientoAceptadoEn, TIMEZONE_BOGOTA, "yyyy-MM-dd HH:mm")
            : "";
        await enviarBienvenidaRectorFusionada({
            usuarioId,
            colegioId: usuario.colegioId,
            version: usuario.consentimientoVersion ?? "",
            fechaAceptacion,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        console.error("[CaminoColegio] Error encolando bienvenida al completar:", msg);
    }

    return { estado: "completado" };
}
