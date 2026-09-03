// SPEC-392 (L3) · baraja aleatoria por sesión + filtros.
import { DirectorioProfesionales } from "@/components/modules/padre/profesionales/DirectorioProfesionales";

export default async function PadreProfesionalesDirectorioPage({
    searchParams,
}: {
    searchParams: Promise<{ u?: string; pres?: string }>;
}) {
    const { u, pres } = await searchParams;
    const urgencia = u === "ESTA_SEMANA" || u === "SIN_APURO" ? u : undefined;
    return (
        <DirectorioProfesionales
            urgenciaInicial={urgencia}
            presentacionInicial={pres}
            hrefPerfil="/dashboard/padre/profesionales"
        />
    );
}
