import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { ConsentimientoService } from "@/lib/dal/services/consentimiento";
import { ModalConsentimiento } from "@/components/modules/ModalConsentimiento";
import type { RolUsuario } from "@prisma/client";

const DASHBOARD_POR_ROL: Record<RolUsuario, string> = {
    // SPEC-339: el padre no va a una pantalla fija — el guardián del camino lo
    // lleva a su paso pendiente (aceptar re-sella la cookie en esta misma ruta).
    PARENT: "/dashboard/padre",
    SCHOOL_ADMIN: "/dashboard/colegio",
    COMITE_CONVIVENCIA: "/dashboard/colegio",
    ADMIN: "/dashboard/admin",
    OPERADOR: "/dashboard/admin",
    COMITE_VALIDACION: "/dashboard/admin",
};

/**
 * Página de consentimiento informado (SPEC-241).
 * Server Component que carga el documento vigente según el rol del usuario.
 */
export default async function ConsentimientoPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    if (!token) {
        redirect("/login");
    }

    const payload = await verifyToken(token);
    const rol = payload?.rol as RolUsuario | undefined;
    const userId = payload?.sub as string | undefined;

    if (!userId || !rol) {
        redirect("/login");
    }

    const servicio = new ConsentimientoService();

    // Si ya aceptó la versión vigente, redirige a su dashboard.
    const estaActual = await servicio.versionEstaActual(userId);
    if (estaActual) {
        redirect(DASHBOARD_POR_ROL[rol]);
    }

    const documentoTipo = servicio.documentoPorRol(rol);
    const documentoContenido = await servicio.obtenerDocumentoVigente(documentoTipo);

    return (
        <ModalConsentimiento
            rol={rol}
            documentoTipo={documentoTipo}
            documentoContenido={documentoContenido}
            redirectUrl={DASHBOARD_POR_ROL[rol]}
            // SPEC-339 (brief §2.2): para el padre, esta pantalla ES el Paso 1
            // del camino. No se rehace: gana el rótulo.
            {...(rol === "PARENT" ? { indicadorPaso: "Paso 1 de 4 · Permiso" } : {})}
        />
    );
}
