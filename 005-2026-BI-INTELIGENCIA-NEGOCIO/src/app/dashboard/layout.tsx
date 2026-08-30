import { ReactNode } from "react";
import { exigirSesionBi } from "@/lib/auth/guard-bi-sesion";
import { BiAppShell } from "@/components/bi/layout/BiAppShell";

// SPEC-029 · guard de sesión de /dashboard · SPEC-035 · refactorizado al
// helper compartido `exigirSesionBi` (mismo guard reutilizado por /operacion,
// anti-recurrencia de I-33). Comportamiento idéntico: sin sesión redirige al
// puente de sesión en PI con returnTo=/dashboard; con sesión envuelve en el
// shell de navegación (sidebar + main).
export default async function DashboardLayout({
    children,
}: {
    children: ReactNode;
}) {
    await exigirSesionBi("/dashboard");
    return <BiAppShell>{children}</BiAppShell>;
}
