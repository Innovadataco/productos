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
    // SPEC-404 (I-290): la bandeja tiene URL propia; el "volver" tras aceptar
    // consentimiento aterriza directo en trabajo real. ADMIN y OPERADOR tienen
    // `bandeja_reportes` (grants por defecto en `seed-modulos-grants.ts:52,68`),
    // así que van directo. COMITE_VALIDACION NO tiene ese módulo (:65 — solo
    // `comite`, `comite_bandeja`, `comite_guias_accion`, `expediente_revelar_original`),
    // por eso queda apuntando a la raíz-aterrizaje: `/dashboard/admin` enruta a
    // `/dashboard/admin/comite` por el paso 3 de `AdminAterrizajePage` (primer
    // ítem permitido por rol). Sin este candado el consentimiento del comité
    // aterrizaba en `<SinAccesoModulo/>`.
    ADMIN: "/dashboard/admin/bandeja",
    OPERADOR: "/dashboard/admin/bandeja",
    COMITE_VALIDACION: "/dashboard/admin",
    // SPEC-408: el Verificador aterriza directo en su cola de trabajo (único módulo).
    VERIFICADOR: "/dashboard/admin/verificacion",
    // SPEC-391 (L1b): el profesional cae a completar su perfil tras crear la
    // cuenta; L5 (panel del profesional) definirá la home real.
    PROFESIONAL: "/perfil-profesional/completar",
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
