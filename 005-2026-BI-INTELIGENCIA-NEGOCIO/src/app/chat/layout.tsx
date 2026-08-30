import { ReactNode } from "react";
import { exigirSesionBi } from "@/lib/auth/guard-bi-sesion";

// SPEC-035 · guard de sesión de /chat (antes público · I-33 seguridad).
// /chat es Client Component: sus datos vienen del API (/api/bi/preguntar, a su
// vez guardado en este SPEC), NO se renderizan server-side, así que el layout
// guard basta (a diferencia de /operacion, que renderiza PII server-side y
// necesita el guard también en su page). No se envuelve en BiAppShell: /chat
// es su propia pantalla full-page, su diseño no cambia.
export default async function ChatLayout({
    children,
}: {
    children: ReactNode;
}) {
    await exigirSesionBi("/chat");
    return <>{children}</>;
}
