import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { PadreSideNav } from "@/components/modules/padre/PadreSideNav";

/**
 * Layout del área del padre (`/dashboard/padre/*`).
 * SPEC-231 (002-PI-131): sidebar padre color cielo + guarda de sesión PARENT.
 * La guarda de vigencia (`verificarVigenciaCliente`) vive en el layout raíz
 * `/dashboard/layout.tsx`; aquí solo se exige sesión PARENT activa.
 */
export default async function PadreLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    if (!token) {
        redirect("/login");
    }

    const payload = await verifyToken(token);
    const rol = payload?.rol as string | undefined;
    if (!payload?.sub || rol !== "PARENT") {
        redirect("/login");
    }

    const usuario = await new UsuarioRepository().findSesionPadre(payload.sub as string);

    if (!usuario || usuario.estado !== "activo" || usuario.rol !== "PARENT") {
        redirect("/login");
    }

    if (usuario.debeCambiarPassword) {
        redirect("/cambiar-password");
    }

    return (
        <div className="theme-padre flex min-h-screen bg-page">
            <PadreSideNav />
            <main className="min-w-0 flex-1">{children}</main>
        </div>
    );
}
