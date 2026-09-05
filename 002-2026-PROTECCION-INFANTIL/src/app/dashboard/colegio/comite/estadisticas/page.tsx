import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { ComiteConvivenciaBandejaService } from "@/lib/dal/services/comite-convivencia-bandeja";
import { ComiteEstadisticas } from "@/components/modules/colegio/comite/ComiteEstadisticas";

export default async function ComiteEstadisticasPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    if (!token) {
        redirect("/login");
    }

    const payload = await verifyToken(token);
    const rol = payload?.rol as string | undefined;
    if (!payload?.sub || !rol) {
        redirect("/login");
    }

    if (rol === "SCHOOL_ADMIN") {
        redirect("/dashboard/colegio/comite/integrantes");
    }

    if (rol !== "COMITE_CONVIVENCIA") {
        redirect("/login");
    }

    const usuario = await new UsuarioRepository().findSesionComite(payload.sub as string);
    if (!usuario || usuario.estado !== "activo" || usuario.rol !== "COMITE_CONVIVENCIA" || !usuario.comiteColegioId) {
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

    const estadisticas = await new ComiteConvivenciaBandejaService().estadisticas(usuario.comiteColegioId);

    return (
        <main className="min-h-screen p-6 md:p-10">
            <div className="mx-auto max-w-4xl space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-body">Estadísticas del comité</h1>
                    <p className="mt-2 text-muted">
                        Agregados de los casos escalados al Comité de Convivencia de su colegio.
                    </p>
                </div>

                <ComiteEstadisticas estadisticas={estadisticas} />
            </div>
        </main>
    );
}
