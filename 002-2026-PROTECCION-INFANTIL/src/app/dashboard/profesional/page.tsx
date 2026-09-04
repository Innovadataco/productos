import type { Metadata } from "next";
import { verifyAuth } from "@/lib/auth";
import { panelDelProfesional } from "@/lib/profesional/panel/panel.service";
import { PanelProfesional } from "@/components/modules/profesional/PanelProfesional";

/**
 * SPEC-425 (A-75 · L5) · El inicio del profesional.
 *
 * Es la pantalla a la que aterriza el rol `PROFESIONAL` (`homeParaRol`). Antes
 * de este lote el rol caía al default `/mis-reportes`, que es del padre —
 * SPEC-424 lo apuntó provisionalmente a `/perfil-profesional/verificacion` y
 * este PR mueve esa línea acá, que es su casa.
 *
 * `force-dynamic`: lo que muestra cambia con cada solicitud que llega y con
 * cada confirmación; una versión cacheada le mentiría sobre su plazo de 48 h.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Inicio",
    description: "Tus solicitudes de primera cita, tu agenda y tu verificación.",
};

export default async function ProfesionalInicioPage() {
    const usuario = await verifyAuth("PROFESIONAL");
    const data = await panelDelProfesional(usuario.id);

    return (
        <main className="min-h-screen bg-page py-4">
            <PanelProfesional data={data} />
        </main>
    );
}
