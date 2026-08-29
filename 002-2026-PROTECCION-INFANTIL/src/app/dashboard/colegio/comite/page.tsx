import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { ComiteConvivenciaBandejaService } from "@/lib/dal/services/comite-convivencia-bandeja";
import { ComiteHome } from "@/components/modules/colegio/comite/ComiteHome";

export default async function ComitePage() {
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

    const resumen = await new ComiteConvivenciaBandejaService().resumen(usuario.comiteColegioId, usuario.id);

    return (
        <main className="min-h-screen p-6 md:p-10">
            <div className="mx-auto max-w-4xl space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-body">Comité de Convivencia</h1>
                    <p className="mt-2 text-muted">
                        Resumen de los casos escalados al Comité de Convivencia de tu colegio.
                    </p>
                </div>

                <ComiteHome resumen={resumen} />
            </div>
        </main>
    );
}
