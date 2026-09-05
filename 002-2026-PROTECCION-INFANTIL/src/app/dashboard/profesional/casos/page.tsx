import type { Metadata } from "next";
import { verifyAuth } from "@/lib/auth";
import { puedeAccederAModulo } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { panelDelProfesional } from "@/lib/profesional/panel/panel.service";
import { CasosPorCerrar, PorCobrar } from "@/components/modules/profesional/PanelProfesional";

/**
 * SPEC-437 (A-75) · «Casos» del menú del profesional.
 *
 * Mismos bloques que el Inicio, misma fuente de datos. El cierre de la cita
 * llega con L6 (SPEC-427): acá se LISTAN los casos que faltan, que es lo que
 * el brief §7 pone en este lote.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Casos",
    description: "Casos por cerrar y el pago retenido.",
};

export default async function CasosPage() {
    const usuario = await verifyAuth("PROFESIONAL");
    // SPEC-496: el módulo manda — revocar `profesional_casos` corta el acceso.
    if (!(await puedeAccederAModulo(usuario.rol, "profesional_casos"))) {
        return <SinAccesoModulo />;
    }
    const data = await panelDelProfesional(usuario.id);

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-6">
            <header>
                <h1 className="text-2xl font-bold text-body">Casos</h1>
                <p className="text-muted">Casos por cerrar y el pago retenido.</p>
            </header>
            <CasosPorCerrar data={data} />
            <PorCobrar data={data} />
        </div>
    );
}
