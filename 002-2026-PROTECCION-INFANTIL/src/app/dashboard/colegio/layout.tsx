import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { ColegioLogoutButton } from "@/components/modules/ColegioLogoutButton";

export default async function ColegioLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    if (!token) {
        redirect("/login");
    }

    const payload = await verifyToken(token);
    if (!payload?.sub || payload.rol !== "SCHOOL_ADMIN") {
        redirect("/login");
    }

    const usuario = await prisma.usuario.findUnique({
        where: { id: payload.sub as string },
        select: { id: true, rol: true, colegioId: true, estado: true },
    });

    if (!usuario || usuario.estado !== "activo" || usuario.rol !== "SCHOOL_ADMIN") {
        redirect("/login");
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

    return (
        <div className="theme-colegio min-h-screen bg-page">
            {children}
        </div>
    );
}
