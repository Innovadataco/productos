/**
 * SPEC-408 · Pantalla del profesional para ver su estado + observaciones y
 * reenviar tras corregir. Datos: server-side desde el helper `vista-profesional`,
 * mismo candado que la API pública (no expone `resultado` ni `checklist`).
 */
import { verifyAuth } from "@/lib/auth";
import { puedeAccederAModulo } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificacionParaProfesional } from "@/lib/profesionales/verificador/vista-profesional";
import { EstadoVerificacionProfesionalClient } from "@/components/modules/verificacion/EstadoVerificacionProfesionalClient";

export const dynamic = "force-dynamic";

export default async function VerificacionProfesionalPage() {
    const user = await verifyAuth("PROFESIONAL");
    // SPEC-496: el módulo manda — revocar `profesional_verificacion` corta el acceso.
    if (!(await puedeAccederAModulo(user.rol, "profesional_verificacion"))) {
        return <SinAccesoModulo />;
    }
    const vista = await verificacionParaProfesional(user.id);
    return <EstadoVerificacionProfesionalClient vista={vista} />;
}
