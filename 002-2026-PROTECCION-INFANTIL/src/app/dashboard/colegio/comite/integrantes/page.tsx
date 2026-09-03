import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { ComiteConvivenciaService } from "@/lib/dal/services/comite-convivencia";
import { ComiteConvivenciaIntegrantesService } from "@/lib/dal/services/comite-convivencia-integrantes";
import { ComiteCuentaCard } from "@/components/modules/colegio/comite/ComiteCuentaCard";
import { IntegrantesList } from "@/components/modules/colegio/comite/IntegrantesList";
import { logger } from "@/lib/logger";

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
    // SPEC-415: el `.catch(() => [])` que había acá convertía un fallo de lectura
    // en "este comité no tiene integrantes". El rector no puede distinguir las
    // dos cosas, y la decisión que toma es cara: volver a documentar personas
    // que YA están registradas. Ahora el fallo se distingue, se registra y se
    // dice en pantalla.
    const [cuenta, integrantes] = await Promise.all([
        new ComiteConvivenciaService().obtenerCuenta(colegioId),
        new ComiteConvivenciaIntegrantesService()
            .listar(colegioId)
            .catch((error: unknown) => {
                logger.error("[ComiteIntegrantes] No se pudo listar los integrantes", error);
                return null;
            }),
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

                {cuenta && integrantes === null && (
                    <div className="rounded-xl border border-ambar/40 bg-ambar/5 p-4">
                        <p className="text-sm font-semibold text-body">
                            No pudimos leer los integrantes del comité.
                        </p>
                        <p className="mt-1 text-sm text-muted">
                            Esto <strong>no</strong> significa que no haya ninguno: significa que no
                            se pudieron consultar. Recarga la página antes de volver a registrarlos,
                            para no duplicar personas que ya están documentadas.
                        </p>
                    </div>
                )}

                {cuenta && integrantes !== null && <IntegrantesList integrantesIniciales={integrantes} />}
            </div>
        </main>
    );
}
