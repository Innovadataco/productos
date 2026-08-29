import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { CasoDetalle } from "@/components/modules/colegio/comite/CasoDetalle";

const ROLES_BANDEJA = new Set(["SCHOOL_ADMIN", "COMITE_CONVIVENCIA"]);

export default async function ComiteCasoDetallePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    if (!token) {
        redirect("/login");
    }

    const payload = await verifyToken(token);
    const rol = payload?.rol as string | undefined;
    if (!payload?.sub || !rol || !ROLES_BANDEJA.has(rol)) {
        redirect("/login");
    }

    const usuario =
        rol === "COMITE_CONVIVENCIA"
            ? await new UsuarioRepository().findSesionComite(payload.sub as string)
            : await new UsuarioRepository().findSesionColegio(payload.sub as string);

    if (!usuario || usuario.estado !== "activo" || usuario.rol !== rol) {
        redirect("/login");
    }

    const vigencia = await verificarVigenciaColegio(usuario.id);
    if (!vigencia.vigente) {
        return (
            <div className="p-8">
                <h1 className="text-2xl font-bold text-body">Servicio no vigente</h1>
                <p className="mt-2 text-muted">{vigencia.mensaje}</p>
            </div>
        );
    }

    const puedeResolver = rol === "COMITE_CONVIVENCIA";

    return (
        <main className="min-h-screen">
            <CasoDetalle solicitudId={id} puedeResolver={puedeResolver} />
        </main>
    );
}
