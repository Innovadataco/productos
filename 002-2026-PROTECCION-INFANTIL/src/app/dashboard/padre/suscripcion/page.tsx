import { verifyAuth } from "@/lib/auth";
import { obtenerVistaSuscripcion } from "@/lib/pagos/suscripcion-vista.service";
import { SuscripcionVista } from "@/components/modules/cliente/suscripcion/SuscripcionVista";
import { SinSuscripcion } from "@/components/modules/cliente/suscripcion/SinSuscripcion";

/**
 * SPEC-211 (002-PI-111): vista de suscripción del padre (color cielo).
 * Reemplaza el placeholder de SPEC-231. El layout `/dashboard/padre` hace la
 * guarda de sesión PARENT; el bloque de contrato solo se muestra si el
 * parámetro `pagos.contrato_obligatorio_padres` lo exige (SPEC-211, decisión 3).
 */
export default async function PadreSuscripcionPage() {
    const usuario = await verifyAuth(["PARENT"]);
    const vista = await obtenerVistaSuscripcion(usuario);

    if (!vista) {
        return <SinSuscripcion />;
    }

    return <SuscripcionVista vista={vista} color="cielo" mostrarContrato={vista.contratoObligatorio} />;
}
