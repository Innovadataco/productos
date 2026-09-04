// SPEC-392 (L3) · baraja aleatoria por sesión + filtros.
// SPEC-428 (L4 M4): propaga `expedienteId` al perfil.
// SPEC-428 (M7): propaga `heredarDe` para que el perfil use reasignación.
import { DirectorioProfesionales } from "@/components/modules/padre/profesionales/DirectorioProfesionales";

export default async function PadreProfesionalesDirectorioPage({
    searchParams,
}: {
    searchParams: Promise<{ u?: string; pres?: string; expedienteId?: string; heredarDe?: string }>;
}) {
    const { u, pres, expedienteId, heredarDe } = await searchParams;
    const urgencia = u === "ESTA_SEMANA" || u === "SIN_APURO" ? u : undefined;
    return (
        <DirectorioProfesionales
            urgenciaInicial={urgencia}
            presentacionInicial={pres}
            hrefPerfil="/dashboard/padre/profesionales"
            {...(expedienteId ? { expedienteIdInicial: expedienteId } : {})}
            {...(heredarDe ? { heredarDeInicial: heredarDe } : {})}
        />
    );
}
