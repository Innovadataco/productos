/**
 * SPEC-408 · Pantalla del profesional para ver su estado + observaciones y
 * reenviar tras corregir. Datos: server-side desde el helper `vista-profesional`,
 * mismo candado que la API pública (no expone `resultado` ni `checklist`).
 */
import { verifyAuth } from "@/lib/auth";
import { puedeAccederAModulo } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificacionParaProfesional } from "@/lib/profesionales/verificador/vista-profesional";
import { obtenerHabilitacionProfesional } from "@/lib/profesionales/habilitacion";
import { EstadoVerificacionProfesionalClient } from "@/components/modules/verificacion/EstadoVerificacionProfesionalClient";

export const dynamic = "force-dynamic";

// «Mi estado» es el PORTERO: NO lleva la guardia de `exigirProfesionalHabilitado`
// (es a donde el guardia MANDA a los no habilitados; gatearla sería un bucle).
export default async function VerificacionProfesionalPage() {
    const user = await verifyAuth("PROFESIONAL");
    // SPEC-496: el módulo manda — revocar `profesional_verificacion` corta el acceso.
    if (!(await puedeAccederAModulo(user.rol, "profesional_verificacion"))) {
        return <SinAccesoModulo />;
    }
    const vista = await verificacionParaProfesional(user.id);
    // SPEC-691 (ajuste del CEO): la pantalla se decide por `habilitado`, no solo por
    // `estado`. En la ventana en que la vigencia venció pero el worker aún no marcó
    // VENCIDO, el perfil dice ACTIVO con habilitado=false → la pantalla muestra VENCIDO
    // (fuente única de 690-A, contra la base).
    const hab = await obtenerHabilitacionProfesional(user.id);
    return <EstadoVerificacionProfesionalClient vista={vista} habilitado={hab?.habilitado ?? false} />;
}
