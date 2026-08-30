import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ReactNode } from "react";
import { sesionDeRequest } from "@/lib/auth/sesion";
import { BiAppShell } from "@/components/bi/layout/BiAppShell";

export default async function DashboardLayout({
    children,
}: {
    children: ReactNode;
}) {
    const h = await headers();
    // Fabricamos un Request-like para reutilizar sesionDeRequest sin duplicar
    // la lógica de extracción de token (candado 22 · SOLO LECTURA de src/lib/auth).
    const req = new Request("http://internal/", {
        headers: {
            authorization: h.get("authorization") ?? "",
            cookie: h.get("cookie") ?? "",
        },
    });
    const sesion = await sesionDeRequest(req);
    if (!sesion) {
        // SPEC-029 · cierra I-30 · redirect al puente de sesión en PI.
        // Antes: redirect("/login") → loop sin retorno funcional (I-30).
        // Ahora: /api/auth/link-bi de PI genera un JWT ephemeral y nos
        // rebota a /api/auth/link con token para setear la cookie session.
        //
        // Limitación conocida (D-029.6 · candado 15 verificado 2026-08-29
        // con `next build && next start` + curl):
        // los headers `x-invoke-path` y `x-forwarded-uri` NO llegan al
        // Server Component (Next.js 15 los descarta antes de `headers()`,
        // aunque se envíen explícitamente en el request). Los únicos
        // proxy-headers presentes son `host`, `x-forwarded-{host,port,proto,for}`.
        // Consecuencia: `returnTo` siempre apunta al home `/dashboard`
        // y no preserva sub-rutas si Jelkin abre una URL específica.
        // No rompe nada (todas las sub-rutas activas hoy son `/dashboard`
        // mismo; el puente de sesión sigue funcionando), pero cuando SPEC-025+
        // agregue sub-rutas evaluamos alternativas (middleware.ts con
        // NextRequest, o extraer del `Referer` cuando esté presente).
        const pi = process.env.PI_BASE_URL ?? "https://pi.innovadataco.com";
        const bi = process.env.BI_BASE_URL ?? "http://localhost:3001";
        const returnTo = `${bi}/dashboard`;
        redirect(
            `${pi}/api/auth/link-bi?returnTo=${encodeURIComponent(returnTo)}`,
        );
    }
    return <BiAppShell>{children}</BiAppShell>;
}
