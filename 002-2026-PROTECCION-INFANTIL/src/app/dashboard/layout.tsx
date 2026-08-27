import { SessionPingProvider } from "@/components/providers/SessionPingProvider";

/**
 * SPEC-287 (002-PI-187): layout raíz UI puro. La guarda de consentimiento y
 * vigencia (SPEC-119/SPEC-241) se mudó al `middleware.ts` en la raíz. Este
 * layout NO ejecuta `redirect(...)` — el ratchet estático lo bloquea.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <SessionPingProvider>
            <div className="min-h-screen">{children}</div>
        </SessionPingProvider>
    );
}
