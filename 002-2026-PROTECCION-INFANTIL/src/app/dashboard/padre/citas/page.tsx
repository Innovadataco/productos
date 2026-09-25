/**
 * SPEC-545 · Listado «Mis citas» del padre. La ruta existía solo como detalle
 * (`citas/[id]`); esta es la pantalla de lista que el item de menú necesitaba
 * para no ser un enlace a 404. RSC autenticada (solo PARENT vía proxy) que trae
 * las citas del padre y las entrega al cliente para agrupar/pintar.
 */
import { exigirPadre } from "@/lib/padre/guardia-padre";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { toCitaParaPadre } from "@/lib/profesional/cita/dto";
import { RejillaMisCitas } from "@/components/modules/padre/citas/RejillaMisCitas";

export default async function PadreCitasPage() {
    const user = await exigirPadre();
    const solicitudes = await new SolicitudCitaRepository().listarPorPadre(user.id);
    const citas = solicitudes.map((s) => toCitaParaPadre(s));
    return (
        <div className="mx-auto w-full max-w-3xl p-4">
            <header className="mb-6">
                <h1 className="titular-seccion text-body">Mis citas</h1>
                <p className="mt-1 text-sm text-muted">
                    Tus citas con los psicólogos de la red, en tu calendario. Toca una para verla.
                </p>
            </header>
            <RejillaMisCitas citas={citas} />
        </div>
    );
}
