import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { obtenerHabilitacionProfesional } from "./habilitacion";

/**
 * SPEC-691 · La compuerta del SERVIDOR para el área operativa del profesional.
 *
 * Cerrar el menú (SPEC-691, primera mitad) esconde las entradas, pero las PÁGINAS
 * siguen alcanzables por URL directa o por aterrizaje del login (`proxy.ts` manda a
 * todo PROFESIONAL a `/dashboard/profesional`). Sin esta guardia, un profesional sin
 * verificar aterriza en el Inicio operativo completo —solicitudes, casos, «abrir un
 * caso con un pase», por cobrar— con el menú escondido: el hallazgo §0 de Calidad con
 * peor pinta, y 403 en cadena cuando 690-B cierre la API. La compuerta también es de
 * las PANTALLAS, no solo del menú.
 *
 * Se decide en el SERVIDOR y contra la BASE (`obtenerHabilitacionProfesional`, fuente
 * única de SPEC-690-A), NUNCA desde la cookie ni el cliente: una compuerta que vive en
 * el cliente falla ABIERTA. `habilitado` = ACTIVO + verificación aprobada vigente; se
 * recalcula en cada request (no se confía en el token).
 *
 * Toda `page.tsx` bajo `app/dashboard/profesional/**` debe llamarla — lo exige, por
 * conducta y derivado del árbol, `guardia-habilitado.candado.test.ts` (la página nueva
 * nace cubierta). Devuelve el usuario y la habilitación para que la página no repita
 * `verifyAuth`.
 */
export async function exigirProfesionalHabilitado() {
    const user = await verifyAuth("PROFESIONAL");
    const hab = await obtenerHabilitacionProfesional(user.id);
    if (!hab?.habilitado) {
        // Portero por estado: sin perfil o en borrador → a completar la ficha; en
        // revisión / vencido / suspendido → a «Mi estado», que muestra dónde está y
        // qué puede hacer (y SUSPENDIDO en solo lectura). Nunca al Inicio operativo.
        const destino =
            !hab || hab.estado === "BORRADOR" ? "/perfil-profesional/completar" : "/perfil-profesional/verificacion";
        redirect(destino);
    }
    return { user, hab };
}
