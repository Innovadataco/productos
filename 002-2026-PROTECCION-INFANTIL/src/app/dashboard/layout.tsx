import { SessionPingProvider } from "@/components/providers/SessionPingProvider";

/**
 * SPEC-287 (002-PI-187): layout raíz UI puro. La guarda de consentimiento y
 * vigencia (SPEC-119/SPEC-241) se mudó al `middleware.ts` en la raíz. Este
 * layout NO ejecuta `redirect(...)` — el ratchet estático lo bloquea.
 *
 * `force-dynamic`: el área privada de dashboard depende de cookies y del
 * middleware — no debe intentarse prerender estático en build. Antes del
 * fix, los layouts arrojaban `redirect()` en build y Next lo interpretaba
 * como dynamic implícito; al retirarlos, hay que declararlo explícito.
 */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <SessionPingProvider>
            <div className="min-h-screen">{children}</div>
        </SessionPingProvider>
    );
}
