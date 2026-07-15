const STORAGE_KEY = "onboarding_completed";

export function isOnboardingComplete(): boolean {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(STORAGE_KEY) === "true";
}

export function markOnboardingComplete(): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, "true");
}

export function resetOnboarding(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
}
