import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { listarExpedientesPadreConUrgencia } from "@/lib/dal/services/expediente-detalle";
import { ExpedientesListClient } from "@/components/modules/padre/ExpedientesListClient";

/**
 * SPEC-605 · Lista «Mis expedientes»: tarjetas ordenadas por URGENCIA
 * (clasificación dominante alta → media → baja → sin clasificar), con chip del
 * menor, EXP/id, semáforo, aporte propio/comunitario y última actividad.
 */
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

    const expedientes = await listarExpedientesPadreConUrgencia(payload.sub as string);

    return (
        <div className="p-4 sm:p-6">
            <ExpedientesListClient
                expedientes={expedientes.map((e) => ({ ...e, ultimaActividad: e.ultimaActividad.toISOString() }))}
            />
        </div>
    );
}
