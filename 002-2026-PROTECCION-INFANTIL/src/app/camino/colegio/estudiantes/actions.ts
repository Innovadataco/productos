"use server";

/**
 * SPEC-962 — Server action del botón «Terminar» (Paso 5 · estudiantes).
 *
 * Antes «Terminar» hacía `router.push('/camino/colegio/listo')` (una pantalla de
 * cierre con un clic de más). Ahora llama a esta acción de SERVIDOR: cierra el
 * camino, encola la bienvenida una sola vez (dentro del servicio) y deja al rector
 * DIRECTO en /dashboard/colegio. El correo NO va como efecto de un GET (prefetch):
 * nace de esta acción explícita.
 *
 * La decisión (pendiente / completado) vive en `completarCaminoColegio` para ser
 * testeable; aquí solo se traduce a redirect + sellado de cookie.
 */
import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { completarCaminoColegio } from "@/lib/dal/services/camino/completar-colegio";
import { destinoDePasoColegio } from "@/lib/camino/pasos-colegio";
import { sellarCookieSesionEstadoEnAccion } from "@/lib/routing/sellar-sesion-estado";

export async function accionCompletarCaminoColegio(): Promise<void> {
    const usuario = await verifyAuth("SCHOOL_ADMIN");

    const resultado = await completarCaminoColegio(usuario.id);
    if (resultado.estado === "pendiente") {
        // Falta un paso: al paso pendiente, SIN correo.
        redirect(destinoDePasoColegio(resultado.paso));
    }

    // Camino cerrado (recién o ya estaba): re-sella la cookie para que el muro de
    // sesión abra el panel al instante (mismo patrón que las acciones del Paso 2).
    await sellarCookieSesionEstadoEnAccion(usuario.id);
    redirect("/dashboard/colegio");
}
