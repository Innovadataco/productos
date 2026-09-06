import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import OnboardingClient from "./OnboardingClient";

/**
 * SPEC-571 (I-353): guardia de rol A NIVEL PÁGINA (wrapper de servidor sobre un
 * componente cliente, patrón SPEC-564). Módulo "colegios_onboarding": el mismo
 * que exige su API (verifyAuth("SCHOOL_ADMIN") + assertModulo("colegios_onboarding")).
 */
export default async function OnboardingPage() {
    const acceso = await verificarAccesoPagina("colegios_onboarding");
    if (!acceso.permitido || acceso.rol !== "SCHOOL_ADMIN") return <SinAccesoModulo volver="/dashboard/colegio" />;
    return <OnboardingClient />;
}
