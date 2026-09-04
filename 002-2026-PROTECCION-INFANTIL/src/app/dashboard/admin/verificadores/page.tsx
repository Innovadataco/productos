/**
 * SPEC-435 · Gestión de cuentas VERIFICADOR (server component gate).
 * UI viva en el client.
 */
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { VerificadoresGestionClient } from "@/components/modules/verificadores-admin/VerificadoresGestionClient";

export const dynamic = "force-dynamic";

export default async function AdminVerificadoresPage() {
    const acceso = await verificarAccesoPagina("verificadores_admin");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return <VerificadoresGestionClient />;
}
