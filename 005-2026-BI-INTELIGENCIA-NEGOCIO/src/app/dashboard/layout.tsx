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
    if (!sesion) redirect("/login");
    return <BiAppShell>{children}</BiAppShell>;
}
