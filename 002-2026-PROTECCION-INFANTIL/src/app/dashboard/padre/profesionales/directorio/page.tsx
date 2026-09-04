// SPEC-392 (L3) · baraja aleatoria por sesión + filtros.
// SPEC-428 (L4 M4): propaga `expedienteId` al perfil.
// SPEC-428 (M7): propaga `heredarDe` para que el perfil use reasignación.
// SPEC-440 (I-306 · Jelkin vivo 04-09): `u` y `pres` ya NO viajan en la URL
// (nombre completo del padre + edades de los menores en la barra de
// direcciones e ID logs). El cliente los lee del `sessionStorage`.
// SPEC-441: la tarjeta pintaba `tarifaConsultaCOP` —la tarifa INFORMATIVA de la
// 2ª cita en adelante— mientras la ficha pintaba el precio estándar de la 1ª. El
// padre veía un número y al entrar veía otro. Se lee acá, del MISMO helper que
// usa la ficha, para que no puedan volver a separarse. (El fix de precio es lo
// único de 441 que sobrevive a 440: `u`/`pres`/`urgencia` los obsoletó 440 y
// NO se relee la URL — reintroducir eso reabriría la fuga de PII de menores.)
import { DirectorioProfesionales } from "@/components/modules/padre/profesionales/DirectorioProfesionales";
import { leerPrecioEstandarPrimeraCita } from "@/lib/profesional/cita/precio-primera-cita";

export default async function PadreProfesionalesDirectorioPage({
    searchParams,
}: {
    searchParams: Promise<{ expedienteId?: string; heredarDe?: string }>;
}) {
    const { expedienteId, heredarDe } = await searchParams;
    const precioPrimeraCitaCOP = await leerPrecioEstandarPrimeraCita();
    return (
        <DirectorioProfesionales
            hrefPerfil="/dashboard/padre/profesionales"
            precioPrimeraCitaCOP={precioPrimeraCitaCOP}
            {...(expedienteId ? { expedienteIdInicial: expedienteId } : {})}
            {...(heredarDe ? { heredarDeInicial: heredarDe } : {})}
        />
    );
}
