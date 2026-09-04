// SPEC-392 (L3) · baraja aleatoria por sesión + filtros.
// SPEC-428 (L4 M4): propaga `expedienteId` al perfil.
// SPEC-428 (M7): propaga `heredarDe` para que el perfil use reasignación.
// SPEC-440 (I-306 · Jelkin vivo 04-09): `u` y `pres` ya NO viajan en la URL
// (nombre completo del padre + edades de los menores en la barra de
// direcciones e ID logs). El cliente los lee del `sessionStorage`.
import { DirectorioProfesionales } from "@/components/modules/padre/profesionales/DirectorioProfesionales";

export default async function PadreProfesionalesDirectorioPage({
    searchParams,
}: {
    searchParams: Promise<{ expedienteId?: string; heredarDe?: string }>;
}) {
    const { expedienteId, heredarDe } = await searchParams;
    return (
        <DirectorioProfesionales
            hrefPerfil="/dashboard/padre/profesionales"
            {...(expedienteId ? { expedienteIdInicial: expedienteId } : {})}
            {...(heredarDe ? { heredarDeInicial: heredarDe } : {})}
        />
    );
}
