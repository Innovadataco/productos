import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { AdminNav } from "@/components/modules/AdminNav";
import { modulosPermitidosParaRol } from "@/lib/permisos-modulos";

/**
 * SPEC-437 (A-75) · la ficha y la verificación también son su área de trabajo.
 *
 * Estas dos pantallas viven fuera de `/dashboard/profesional` por historia
 * (SPEC-391), pero son del mismo actor y aparecen en su menú. Sin este layout,
 * el profesional perdía la barra lateral justo al entrar a dos de sus cinco
 * ítems — media queja de Jelkin resuelta es una queja viva.
 *
 * Layout de UI pura, como el del admin (SPEC-287): **no ejecuta `redirect`**.
 */
export default async function PerfilProfesionalLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const rol = (payload?.rol as string | undefined) ?? "PROFESIONAL";
    const permitidos = await modulosPermitidosParaRol(rol);

    return (
        <div className="flex min-h-screen">
            <AdminNav rol="PROFESIONAL" modulosPermitidos={[...permitidos]} />
            <main className="flex-1 overflow-auto">{children}</main>
        </div>
    );
}
