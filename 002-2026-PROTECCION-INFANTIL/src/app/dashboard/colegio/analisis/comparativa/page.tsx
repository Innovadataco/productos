import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import ComparativaCursosClient from "./ComparativaCursosClient";

/**
 * SPEC-571 (I-353): guardia de rol A NIVEL PÁGINA (wrapper de servidor sobre un
 * componente cliente, patrón SPEC-564). Módulo "colegios_gestion": el mismo que
 * exige su API (verifyAuth("SCHOOL_ADMIN") + assertModulo("colegios_gestion"))
 * y que ya guarda las estadísticas del colegio.
 */
export default async function ComparativaCursosPage() {
    const acceso = await verificarAccesoPagina("colegios_gestion");
    if (!acceso.permitido || acceso.rol !== "SCHOOL_ADMIN") return <SinAccesoModulo volver="/dashboard/colegio" />;
    return <ComparativaCursosClient />;
}
