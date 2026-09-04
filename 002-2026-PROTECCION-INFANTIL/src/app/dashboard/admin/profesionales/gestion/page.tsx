/**
 * SPEC-421 · Gestión de profesionales por admin.
 * Server component gate; UI viva en el client.
 */
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { ProfesionalesGestionClient } from "@/components/modules/profesionales-admin/ProfesionalesGestionClient";

export const dynamic = "force-dynamic";

export default async function AdminProfesionalesGestionPage() {
    const acceso = await verificarAccesoPagina("profesionales_admin");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return <ProfesionalesGestionClient />;
}
