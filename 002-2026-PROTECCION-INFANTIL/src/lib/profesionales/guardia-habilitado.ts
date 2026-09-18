import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { obtenerHabilitacionProfesional } from "./habilitacion";
import { AutorizacionProfesionalService } from "@/lib/dal/services/autorizacion-profesional";

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
        // SPEC-706: una sola pantalla. «Mi estado» (/perfil-profesional/verificacion) se retiró;
        // su contenido (el estado + observaciones) vive ahora como ENCABEZADO de la ficha. Todo no
        // habilitado —sin perfil, BORRADOR, EN_REVISION, VENCIDO, SUSPENDIDO— va a la FICHA, que le
        // muestra su estado arriba y (según de quién es el turno) lo deja editar o no. Nunca al
        // Inicio operativo.
        redirect("/perfil-profesional/completar");
    }
    // SPEC-686 (I-420): la guardia de RE-ACEPTACIÓN vive EN la misma compuerta (no un redirect
    // aparte). Aun HABILITADO, si la autorización vigente es DE FONDO y el profesional no la
    // aceptó, se le lleva a (re)aceptarla antes de operar. NO toca estado ni vigencia — solo
    // pausa el acceso operativo hasta que acepte. La pantalla de aceptación vive fuera de
    // `/dashboard/profesional/**`, así que no hay bucle de redirección.
    if (await new AutorizacionProfesionalService().necesitaAceptar(user.id)) {
        redirect("/perfil-profesional/autorizacion");
    }
    return { user, hab };
}
