// SPEC-392 (L3) · perfil individual del profesional.
// Carga server-side el perfil (allowlist H-2) y le pasa al cliente el estado
// que el padre trajo (presentación + urgencia) por query string.
import { notFound } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { ProfesionalPerfil } from "@/components/modules/padre/profesionales/ProfesionalPerfil";

export default async function PadreProfesionalPerfilPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ u?: string; pres?: string }>;
}) {
    const user = await verifyAuth();
    if (user.rol !== "PARENT") redirect("/");

    const { id } = await params;
    const { u, pres } = await searchParams;
    const urgencia = u === "ESTA_SEMANA" || u === "SIN_APURO" ? u : undefined;

    const perfil = await new PerfilProfesionalRepository().obtenerPublicoPorId(id);
    if (!perfil) notFound();

    return (
        <ProfesionalPerfil
            p={perfil}
            presentacionDelPadre={pres}
            urgencia={urgencia}
        />
    );
}
