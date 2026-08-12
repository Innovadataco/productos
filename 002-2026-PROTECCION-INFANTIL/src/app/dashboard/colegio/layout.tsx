import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { ColegioLogoutButton } from "@/components/modules/ColegioLogoutButton";
import { ColegioSideNav } from "@/components/modules/colegio/ColegioSideNav";
import { BuscadorGlobal } from "@/components/modules/colegio/BuscadorGlobal";
import { modulosPermitidosParaRol } from "@/lib/permisos-modulos";

const ROLES_COLEGIO = new Set(["SCHOOL_ADMIN", "COMITE_CONVIVENCIA"]);

export default async function ColegioLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    if (!token) {
        redirect("/login");
    }

    const payload = await verifyToken(token);
    const rol = payload?.rol as string | undefined;
    if (!payload?.sub || !rol || !ROLES_COLEGIO.has(rol)) {
        redirect("/login");
    }

    // E-8: la consulta vive en el repo; el componente no toca prisma.
    const usuario =
        rol === "COMITE_CONVIVENCIA"
            ? await new UsuarioRepository().findSesionComite(payload.sub as string)
            : await new UsuarioRepository().findSesionColegio(payload.sub as string);

    if (!usuario || usuario.estado !== "activo" || usuario.rol !== rol) {
        redirect("/login");
    }

    // Enforcement central: cualquier usuario con contraseña temporal debe cambiarla
    // antes de usar su panel (mismo criterio que el comité de validación).
    if (usuario.debeCambiarPassword) {
        redirect("/cambiar-password");
    }

    const vigencia = await verificarVigenciaColegio(usuario.id);

    if (!vigencia.vigente) {
        return (
            <div className="theme-colegio min-h-screen bg-page">
                <main className="flex min-h-screen flex-col items-center justify-center px-4">
                    <div className="w-full max-w-md rounded-2xl glass p-8 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full accent-gradient text-white text-2xl font-bold">
                            🏫
                        </div>
                        <h1 className="text-2xl font-bold text-body">Servicio no vigente</h1>
                        <p className="mt-4 text-muted">
                            {vigencia.mensaje || "El acceso institucional no está disponible en este momento. Contacta al administrador de tu colegio para más información."}
                        </p>
                        <ColegioLogoutButton
                            className="mt-6 inline-flex rounded-xl accent-gradient px-6 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90 transition"
                        />
                    </div>
                </main>
            </div>
        );
    }

    const permitidos = await modulosPermitidosParaRol(usuario.rol);

    // SPEC-129 (C3): navegación lateral única patrón AdminNav (antes ColegioNav, tabs).
    // SPEC-148 (US2): buscador global ⌘K montado UNA vez para toda el área.
    return (
        <div className="theme-colegio flex min-h-screen bg-page">
            <ColegioSideNav rol={usuario.rol} modulosPermitidos={[...permitidos]} />
            <BuscadorGlobal />
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}
