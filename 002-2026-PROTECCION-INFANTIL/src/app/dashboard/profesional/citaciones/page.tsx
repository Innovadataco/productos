import type { Metadata } from "next";
import { verifyAuth } from "@/lib/auth";
import { panelDelProfesional } from "@/lib/profesional/panel/panel.service";
import { Solicitudes, CitasConfirmadas } from "@/components/modules/profesional/PanelProfesional";

/**
 * SPEC-437 (A-75) · «Citaciones» del menú del profesional.
 *
 * Reusa los bloques del Inicio y `panelDelProfesional`: la pantalla dedicada y
 * el resumen tienen que decir lo mismo del mismo dato, y copiar el bloque es
 * exactamente cómo empiezan a divergir.
 *
 * `force-dynamic`: cambia con cada solicitud que llega y cada confirmación.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Citaciones",
    description: "Solicitudes por responder y citas confirmadas.",
};

export default async function CitacionesPage() {
    const usuario = await verifyAuth("PROFESIONAL");
    const data = await panelDelProfesional(usuario.id);

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-6">
            <header>
                <h1 className="text-2xl font-bold text-body">Citaciones</h1>
                <p className="text-muted">Solicitudes por responder y citas confirmadas.</p>
            </header>
            <Solicitudes data={data} />
            <CitasConfirmadas data={data} />
        </div>
    );
}
