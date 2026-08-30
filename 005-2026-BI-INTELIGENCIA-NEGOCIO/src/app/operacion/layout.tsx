import { ReactNode } from "react";
import { exigirSesionBi } from "@/lib/auth/guard-bi-sesion";

// SPEC-035 · guard de sesión de /operacion (antes público · I-33 seguridad).
// /operacion es full-page standalone: NO se envuelve en BiAppShell · el diseño
// del tablero (SPEC-033) no cambia. Este layout SOLO aplica el guard.
export default async function OperacionLayout({
    children,
}: {
    children: ReactNode;
}) {
    await exigirSesionBi("/operacion");
    return <>{children}</>;
}
