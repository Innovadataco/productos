import { OnboardingModal } from "@/components/modules/colegio/OnboardingModal";

/**
 * SPEC-169 (Fase G) — Página dedicada para reactivar o continuar el onboarding.
 * El modal se fuerza abierto; el layout del colegio ya provee navegación y header.
 */
export default function OnboardingPage() {
    return <OnboardingModal forceOpen />;
}
