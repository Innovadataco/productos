import { OnboardingTour } from "./OnboardingTour";

export function OnboardingTourWrapper() {
    const disabled = process.env.NEXT_PUBLIC_DISABLE_ONBOARDING === "true";
    return <OnboardingTour disabled={disabled} />;
}
