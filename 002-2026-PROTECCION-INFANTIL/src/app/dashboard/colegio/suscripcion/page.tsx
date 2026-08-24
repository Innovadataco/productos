import { verifyAuth } from "@/lib/auth";
import { obtenerVistaSuscripcion } from "@/lib/pagos/suscripcion-vista.service";
import { SuscripcionVista } from "@/components/modules/cliente/suscripcion/SuscripcionVista";
import { SinSuscripcion } from "@/components/modules/cliente/suscripcion/SinSuscripcion";

/**
 * SPEC-211 (002-PI-111): vista de suscripción del rector (color pino).
 * La guarda de sesión/rol/vigencia la hace el layout `/dashboard/colegio`;
 * aquí se carga el DTO vía el servicio (frontera DAL, SC-005: sin `@/lib/prisma`
 * en la página) y se renderizan los 7 bloques estándar.
 */
export default async function ColegioSuscripcionPage() {
    const usuario = await verifyAuth(["SCHOOL_ADMIN"]);
    const vista = await obtenerVistaSuscripcion(usuario);

    if (!vista) {
        return <SinSuscripcion />;
    }

    // Contrato: para colegios el bloque siempre se muestra (obligatorio por defecto).
    return <SuscripcionVista vista={vista} color="pino" mostrarContrato={true} />;
}
