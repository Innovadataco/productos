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
        const pi =
            process.env.PI_BASE_URL ?? "https://pi.innovadataco.com";
        const bi = process.env.BI_BASE_URL ?? "http://localhost:3001";
        // Path del request actual: Next.js expone x-invoke-path en Server
        // Components. Fallback seguro a /dashboard si no viene.
        const currentPath =
            h.get("x-invoke-path") ?? h.get("x-forwarded-uri") ?? "/dashboard";
        const returnTo = `${bi}${currentPath}`;
        redirect(
            `${pi}/api/auth/link-bi?returnTo=${encodeURIComponent(returnTo)}`,
        );
    }
    return <BiAppShell>{children}</BiAppShell>;
}
