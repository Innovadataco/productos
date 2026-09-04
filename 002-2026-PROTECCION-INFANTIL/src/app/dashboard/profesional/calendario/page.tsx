import type { Metadata } from "next";
import { verifyAuth } from "@/lib/auth";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { FranjaDisponibleRepository } from "@/lib/dal/repositories/franja-disponible";
import { AppError, ERROR_CODES } from "@/lib/errors";
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
    description: "Publica y retira las franjas en las que atiendes.",
};

export default async function CalendarioProfesionalPage() {
    const usuario = await verifyAuth("PROFESIONAL");
    const perfil = await new PerfilProfesionalRepository().findPorUsuarioId(usuario.id);
    if (!perfil) {
        throw new AppError("Perfil profesional no existe", ERROR_CODES.NOT_FOUND, 404);
    }

    const franjas = await new FranjaDisponibleRepository().listarDeProfesional(perfil.id);

    return (
        <main className="min-h-screen bg-page py-4">
            <CalendarioProfesional
                duracionMinutos={perfil.duracionMinutos}
                atiendeVirtual={perfil.atiendeVirtual}
                atiendePresencial={perfil.atiendePresencial}
                franjas={franjas.map((f) => ({
                    id: f.id,
                    inicio: f.inicio.toISOString(),
                    fin: f.fin.toISOString(),
                    modalidad: f.modalidad,
                    tomada: f.tomada,
                }))}
            />
        </main>
    );
}
