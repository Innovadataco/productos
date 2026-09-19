import { exigirPadre } from "@/lib/padre/guardia-padre";
import { listarExpedientesPadreConUrgencia } from "@/lib/dal/services/expediente-detalle";
import { ExpedientesListClient } from "@/components/modules/padre/ExpedientesListClient";

/**
 * SPEC-605 · Lista «Mis expedientes»: tarjetas ordenadas por URGENCIA
 * (clasificación dominante alta → media → baja → sin clasificar), con chip del
 * menor, EXP/id, semáforo, aporte propio/comunitario y última actividad.
 */
export default async function PadreExpedientesPage() {
    const usuario = await exigirPadre(); // SPEC-711: compuerta por rol (rol ≠ PARENT → su área)
    const expedientes = await listarExpedientesPadreConUrgencia(usuario.id);

    return (
        <div className="p-4 sm:p-6">
            <ExpedientesListClient
                expedientes={expedientes.map((e) => ({ ...e, ultimaActividad: e.ultimaActividad.toISOString() }))}
            />
        </div>
    );
}
