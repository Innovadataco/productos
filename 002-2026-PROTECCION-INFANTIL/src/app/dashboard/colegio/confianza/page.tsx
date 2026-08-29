import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import ConfianzaPageClient from "./ConfianzaPageClient";

/**
 * SPEC-154 — Página de confianza del colegio.
 * Transparencia, protocolo e historial de auditoría para SCHOOL_ADMIN.
 */
export default async function ConfianzaPage() {
    const acceso = await verificarAccesoPagina("colegios_gestion");
    if (!acceso.permitido) return <SinAccesoModulo volver="/dashboard/colegio" />;
    return <ConfianzaPageClient />;
}
