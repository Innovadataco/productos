import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";
import { ExpedientesListClient } from "@/components/modules/padre/ExpedientesListClient";

export default async function PadreExpedientesPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    if (!token) {
        redirect("/login");
    }

    const payload = await verifyToken(token);
    if (!payload?.sub || payload.rol !== "PARENT") {
        redirect("/login");
    }

    const resultado = await new ExpedienteRepository().listarExpedientesDePadre(payload.sub as string, {
        page: 1,
        pageSize: 50,
    });

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-body">Mis expedientes</h1>
                <p className="mt-1 text-sm text-muted">
                    Revisa el estado de las situaciones que has reportado y agrega nuevos eventos.
                </p>
            </div>
            <ExpedientesListClient expedientes={resultado.items} />
        </div>
    );
}
