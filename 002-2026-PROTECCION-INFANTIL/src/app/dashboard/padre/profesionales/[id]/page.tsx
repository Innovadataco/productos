// SPEC-392 (L3) · perfil individual del profesional.
// SPEC-428 (L4): agrega precio estándar de primera cita + propagación del
// `expedienteId` que vino del expediente vivo (momento 4 del brief §9).
// SPEC-428 (M7): `heredarDe` marca el flujo «elegir otro sin volver a pagar».
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
    searchParams: Promise<{ u?: string; pres?: string; expedienteId?: string; heredarDe?: string }>;
}) {
    const user = await verifyAuth();
    if (user.rol !== "PARENT") redirect("/");

    const { id } = await params;
    const { u, pres, expedienteId, heredarDe } = await searchParams;
    const urgencia = u === "ESTA_SEMANA" || u === "SIN_APURO" ? u : undefined;

    const [perfil, precioEstandarPrimeraCitaCOP] = await Promise.all([
        new PerfilProfesionalRepository().obtenerPublicoPorId(id),
        leerPrecioEstandarPrimeraCita(),
    ]);
    if (!perfil) notFound();

    return (
        <ProfesionalPerfil
            p={perfil}
            presentacionDelPadre={pres}
            urgencia={urgencia}
            precioEstandarPrimeraCitaCOP={precioEstandarPrimeraCitaCOP}
            expedienteIdSugerido={expedienteId}
            heredarDeSolicitudId={heredarDe}
        />
    );
}
