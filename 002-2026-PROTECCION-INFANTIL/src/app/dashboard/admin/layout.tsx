import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { AdminNav } from "@/components/modules/AdminNav";
import { AdminVersionBadge } from "@/components/modules/AdminVersionBadge";
import { modulosPermitidosParaRol } from "@/lib/permisos-modulos";

const ADMIN_ROLES = new Set(["ADMIN", "OPERADOR", "COMITE_VALIDACION"]);
type AdminRol = "ADMIN" | "OPERADOR" | "COMITE_VALIDACION";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    if (!token) {
        redirect("/login");
    }

    const payload = await verifyToken(token);
    const rol = payload?.rol as string | undefined;
    if (!rol || !ADMIN_ROLES.has(rol)) {
        redirect("/");
    }

    // Enforcement central: cualquier rol interno con contraseña temporal debe
    // cambiarla antes de usar el panel (igual que SCHOOL_ADMIN en su layout).
    if (payload?.sub) {
        // E-8: la consulta vive en el repo; el componente no toca prisma.
        const usuario = await new UsuarioRepository().findDebeCambiarPassword(payload.sub as string);
        if (usuario?.debeCambiarPassword) {
            redirect("/cambiar-password");
        }
    }

    const permitidos = await modulosPermitidosParaRol(rol);

    return (
        <div className="flex min-h-screen">
            <AdminNav rol={rol as AdminRol} modulosPermitidos={[...permitidos]} />
            <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                {children}
                <AdminVersionBadge />
            </main>
        </div>
    );
}
