import type { Metadata } from "next";
import { exigirProfesionalHabilitado } from "@/lib/profesionales/guardia-habilitado";
import { puedeAccederAModulo } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { calendarioDelProfesional } from "@/lib/profesional/calendario/calendario.service";
import { CalendarioProfesional } from "@/components/modules/profesional/CalendarioProfesional";

/**
 * SPEC-437 (A-75) · «Citaciones» del menú del profesional.
 *
 * SPEC-714 (pedido de Jelkin): «Citaciones» muestra el MISMO calendario que
 * «Calendario» — un solo componente, no dos cuadrículas. En este modo lidera con
 * la lista «Esperando su respuesta» encima de la rejilla, para que lo accionable
 * salte primero; los estados de la cita viven dentro de la cuadrícula.
 *
 * `force-dynamic`: cambia con cada solicitud que llega y cada confirmación.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Citaciones",
    description: "Sus solicitudes por responder y su agenda, en el calendario.",
};

export default async function CitacionesPage() {
    // SPEC-691: compuerta primero — no habilitado → portero (contra la base).
    const { user: usuario } = await exigirProfesionalHabilitado();
    // SPEC-496: el módulo manda — revocar `profesional_citaciones` corta el acceso.
    if (!(await puedeAccederAModulo(usuario.rol, "profesional_citaciones"))) {
        return <SinAccesoModulo />;
    }
    const datos = await calendarioDelProfesional(usuario.id);

    return (
        <main className="min-h-screen bg-page py-4">
            <CalendarioProfesional datos={datos} modo="citaciones" />
        </main>
    );
}
