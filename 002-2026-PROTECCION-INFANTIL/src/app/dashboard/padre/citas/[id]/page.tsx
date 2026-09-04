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
import { verifyAuth } from "@/lib/auth";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { toCitaParaPadre } from "@/lib/profesional/cita/dto";
import { EsperaCitaPanel } from "@/components/modules/padre/citas/EsperaCitaPanel";

export default async function CitaPadreDetallePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const user = await verifyAuth("PARENT");
    const cita = await new SolicitudCitaRepository().findParaPadre(id, user.id);
    if (!cita) {
        // No revela si existe o no — enruta a la lista del padre.
        redirect("/dashboard/padre");
    }
    return <EsperaCitaPanel citaInicial={toCitaParaPadre(cita)} />;
}
