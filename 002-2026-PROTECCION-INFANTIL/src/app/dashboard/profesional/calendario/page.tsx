import type { Metadata } from "next";
import { exigirProfesionalHabilitado } from "@/lib/profesionales/guardia-habilitado";
import { puedeAccederAModulo } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { calendarioDelProfesional } from "@/lib/profesional/calendario/calendario.service";
import { CalendarioProfesional } from "@/components/modules/profesional/CalendarioProfesional";

/**
 * SPEC-447 (I-311) · La pantalla que faltaba.
 *
 * `POST /api/profesional/franjas` existe desde SPEC-395 (L4) y **nunca tuvo
 * quién lo llamara**: en producción `FranjaDisponible` tenía 0 filas en toda su
 * historia. Sin disponibilidad publicada ninguna familia puede agendar, así que
 * arreglar el 400 de I-310 dejaba la funcionalidad igual de muerta.
 *
 * La ruta la fijó el CEO antes de que nadie construyera: vive en
 * `/dashboard/profesional/calendario` —área de TRABAJO— y no bajo
 * `/perfil-profesional/*`, que es donde el profesional completa y verifica su
 * ficha. Calidad ya tenía un candado apuntando a la ruta equivocada.
 *
 * `force-dynamic`: la agenda cambia con cada reserva del padre; una versión
 * cacheada le mostraría como libre una franja ya tomada.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Calendario",
    description: "Publique sus franjas y responda las solicitudes, en un solo lugar.",
};

export default async function CalendarioProfesionalPage() {
    // SPEC-691: compuerta primero — no habilitado → portero (contra la base).
    const { user: usuario } = await exigirProfesionalHabilitado();
    // SPEC-496: el módulo manda — revocar `profesional_calendario` corta el acceso.
    if (!(await puedeAccederAModulo(usuario.rol, "profesional_calendario"))) {
        return <SinAccesoModulo />;
    }
    const datos = await calendarioDelProfesional(usuario.id);

    return (
        <main className="min-h-screen bg-page py-4">
            <CalendarioProfesional datos={datos} />
        </main>
    );
}
