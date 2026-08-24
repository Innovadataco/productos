import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";
import { ExpedienteDetalleClient } from "@/components/modules/padre/ExpedienteDetalleClient";

export default async function PadreExpedienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    if (!token) {
        redirect("/login");
    }

    const payload = await verifyToken(token);
    if (!payload?.sub || payload.rol !== "PARENT") {
        redirect("/login");
    }

    const expediente = await new ExpedienteRepository().obtenerExpedientePorId(id, payload.sub as string);

    if (!expediente) {
        notFound();
    }

    return (
        <div className="p-6">
            <ExpedienteDetalleClient
                expediente={{
                    id: expediente.id,
                    identificadorReportado: expediente.identificadorReportado,
                    estado: expediente.estado,
                    scoreGravedadActual: expediente.scoreGravedadActual,
                    fechaApertura: expediente.fechaApertura,
                    numEventos: expediente.numEventos,
                }}
                eventos={expediente.eventos}
            />
        </div>
    );
}
