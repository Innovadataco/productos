import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { hechosDelExpediente } from "@/lib/dal/services/expediente-vivo";
import { ExpedienteVivo } from "@/components/modules/padre/ExpedienteVivo";

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

    // SPEC-340 (A-68 §4): la ventana del expediente vivo — mapa con historia,
    // línea de tiempo mío/ajeno/anónimo, lectura e informes para siempre.
    const datos = await hechosDelExpediente(id, payload.sub as string);

    if (!datos) {
        notFound();
    }

    return (
        <div className="p-4 sm:p-6">
            <ExpedienteVivo
                expedienteId={datos.expediente.id}
                identificador={datos.expediente.identificadorReportado}
                hechos={datos.hechos.map((h) => ({ ...h, fecha: h.fecha.toISOString() }))}
                informes={datos.informes.map((i) => ({ ...i, generadoEn: i.generadoEn.toISOString() }))}
            />
        </div>
    );
}
