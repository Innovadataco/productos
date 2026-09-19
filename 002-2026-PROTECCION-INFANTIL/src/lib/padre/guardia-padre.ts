import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { homeParaRol } from "@/lib/auth/home-para-rol";

/**
 * SPEC-711 · La compuerta por ROL del área del padre.
 *
 * Jelkin, con su cuenta de PROFESIONAL, abrió `/dashboard/padre/profesionales` y vio el
 * formulario del padre («Su presentación»). Medido: de las 15 páginas de
 * `/dashboard/padre/**`, la mayoría no comprobaba el rol. Los DATOS sí están protegidos
 * —las APIs exigen PARENT—, así que no es una fuga ([[dev-barrido-guardia-pagina-shell-no-es-fuga]]);
 * es el cascarón, y un rol paseándose por el área de otro erosiona la separación que el
 * producto promete.
 *
 * Patrón de la compuerta del profesional (SPEC-691/690-B): si el rol no corresponde, se va
 * a SU área —`homeParaRol`—, NO a un 403. `verifyAuth("PARENT")` tiraría 403 (un error); acá
 * autenticamos y, si no es PARENT, se redirige al home del rol. El no autenticado lo maneja
 * `verifyAuth` (401 → login), como en la compuerta del profesional.
 *
 * Toda `page.tsx` bajo `app/dashboard/padre/**` debe llamarla — lo exige, por conducta y
 * derivado del árbol, `compuerta-rol-padre.candado.test.ts`: una página nueva sin la
 * compuerta lo pone rojo (nace cubierta). Devuelve el usuario para que la página no repita
 * `verifyAuth`.
 */
export async function exigirPadre() {
    const user = await verifyAuth();
    if (user.rol !== "PARENT") {
        redirect(homeParaRol(user.rol));
    }
    return user;
}
