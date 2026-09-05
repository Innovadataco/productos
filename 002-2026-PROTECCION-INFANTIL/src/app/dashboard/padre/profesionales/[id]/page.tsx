// SPEC-392 (L3) · perfil individual del profesional.
// SPEC-428 (L4): agrega precio estándar de primera cita + propagación del
// `expedienteId` que vino del expediente vivo (momento 4 del brief §9).
// SPEC-428 (M7): `heredarDe` marca el flujo «elegir otro sin volver a pagar».
// SPEC-440 (I-306 · Jelkin vivo 04-09): `u` y `pres` ya NO viajan en URL —
// `SolicitarCitaPanel` los lee del `sessionStorage` en cliente. La página
// server solo pasa IDs opacos.
import { notFound } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { ProfesionalPerfil } from "@/components/modules/padre/profesionales/ProfesionalPerfil";
import { leerPrecioEstandarPrimeraCita } from "@/lib/profesional/cita/precio-primera-cita";

export default async function PadreProfesionalPerfilPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ expedienteId?: string; heredarDe?: string }>;
}) {
    const user = await verifyAuth();
    if (user.rol !== "PARENT") redirect("/");

    const { id } = await params;
    const { expedienteId, heredarDe } = await searchParams;

    const [perfil, precioEstandarPrimeraCitaCOP] = await Promise.all([
        new PerfilProfesionalRepository().obtenerPublicoPorId(id),
        leerPrecioEstandarPrimeraCita(),
    ]);
    if (!perfil) notFound();

    return (
        <ProfesionalPerfil
            p={perfil}
            precioEstandarPrimeraCitaCOP={precioEstandarPrimeraCitaCOP}
            expedienteIdSugerido={expedienteId}
            heredarDeSolicitudId={heredarDe}
        />
    );
}
