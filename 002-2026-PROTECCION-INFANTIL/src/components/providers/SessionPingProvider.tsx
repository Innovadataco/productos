"use client";

import { useSessionPing } from "@/hooks/useSessionPing";

/**
 * Provider que monta el ping de sesión para toda el área autenticada.
 * SPEC-206 (002-PI-120).
 */
export function SessionPingProvider({ children }: { children: React.ReactNode }) {
    useSessionPing();
    return <>{children}</>;
}
