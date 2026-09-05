import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { AdminNav } from "@/components/modules/AdminNav";
import { AdminVersionBadge } from "@/components/modules/AdminVersionBadge";
import { modulosPermitidosParaRol } from "@/lib/permisos-modulos";

type AdminRol = "ADMIN" | "OPERADOR" | "COMITE_VALIDACION";

/**
 * SPEC-287 (002-PI-187): layout UI puro. Todos los guardianes de acceso
 * (sesión, permisos de rol, cambiar-password) viven ahora en `middleware.ts`.
 * Este layout NO ejecuta `redirect(...)` — el ratchet estático lo bloquea.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const rol = (payload?.rol as string | undefined) ?? "ADMIN";
    const permitidos = await modulosPermitidosParaRol(rol);

    return (
        // SPEC-460: el acento del territorio IDC es ámbar-ink (theme-admin).
        <div className="theme-admin flex min-h-screen">
            <AdminNav rol={rol as AdminRol} modulosPermitidos={[...permitidos]} />
            <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                {children}
                <AdminVersionBadge />
            </main>
        </div>
    );
}
