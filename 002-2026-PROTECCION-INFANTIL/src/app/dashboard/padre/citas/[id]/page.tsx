/**
 * SPEC-428 (A-75 · brief §9 M6-M7) · Pantalla de espera del padre después
 * de pagar la primera cita: estado + reloj de 48 h hasta que el profesional
 * responde; salida a «Elegir otro sin volver a pagar» cuando la cita vence
 * o el profesional no asiste (heredar pago via `/reasignar`, SPEC-395).
 *
 * La ruta está autenticada (proxy: solo PARENT). La página es RSC + un
 * cliente que trae el detalle vivo y calcula el countdown.
 */
import { redirect } from "next/navigation";
import { exigirPadre } from "@/lib/padre/guardia-padre";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { toCitaParaPadre } from "@/lib/profesional/cita/dto";
import { listarExpedientesPadreParaCompartir } from "@/lib/dal/services/expediente-detalle";
import { EsperaCitaPanel } from "@/components/modules/padre/citas/EsperaCitaPanel";

export default async function CitaPadreDetallePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const user = await exigirPadre();
    const cita = await new SolicitudCitaRepository().findParaPadre(id, user.id);
    if (!cita) {
        // No revela si existe o no — enruta a la lista de citas (SPEC-545 la creó).
        redirect("/dashboard/padre/citas");
    }
    const citaDto = toCitaParaPadre(cita);
    // SPEC-731: la cita confirmada ofrece «compartir un caso» como EXTRA opcional.
    // Solo entonces necesitamos la lista corta de casos del padre (si no tiene
    // ninguno → []; la pantalla muestra «no hace falta», nunca un callejón). No
    // se consulta en otros estados para no pagar la lectura de más.
    const expedientes =
        citaDto.estado === "CONFIRMADA" ? await listarExpedientesPadreParaCompartir(user.id) : [];
    return <EsperaCitaPanel citaInicial={citaDto} expedientes={expedientes} />;
}
