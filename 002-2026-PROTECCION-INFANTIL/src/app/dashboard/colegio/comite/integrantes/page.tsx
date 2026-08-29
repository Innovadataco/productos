import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { ComiteConvivenciaService } from "@/lib/dal/services/comite-convivencia";
import { ComiteConvivenciaIntegrantesService } from "@/lib/dal/services/comite-convivencia-integrantes";
import { ComiteCuentaCard } from "@/components/modules/colegio/comite/ComiteCuentaCard";
import { IntegrantesList } from "@/components/modules/colegio/comite/IntegrantesList";

export default async function ComiteIntegrantesPage() {
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

    if (rol === "COMITE_CONVIVENCIA") {
        redirect("/dashboard/colegio/comite");
    }

    if (rol !== "SCHOOL_ADMIN") {
        redirect("/login");
    }

    const usuario = await new UsuarioRepository().findSesionColegio(payload.sub as string);
    if (!usuario || usuario.estado !== "activo" || usuario.rol !== "SCHOOL_ADMIN" || !usuario.colegioId) {
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

    const colegioId = usuario.colegioId;
    const [cuenta, integrantes] = await Promise.all([
        new ComiteConvivenciaService().obtenerCuenta(colegioId),
        new ComiteConvivenciaIntegrantesService().listar(colegioId).catch(() => []),
    ]);

    return (
        <main className="min-h-screen p-6 md:p-10">
            <div className="mx-auto max-w-4xl space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-body">Comité de Convivencia</h1>
                    <p className="mt-2 text-muted">
                        Crea la cuenta compartida del comité y documenta a sus integrantes.
                    </p>
                </div>

                <ComiteCuentaCard cuenta={cuenta} />

                {cuenta && <IntegrantesList integrantesIniciales={integrantes} />}
            </div>
        </main>
    );
}
