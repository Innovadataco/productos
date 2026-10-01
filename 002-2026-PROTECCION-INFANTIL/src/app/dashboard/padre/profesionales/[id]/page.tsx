// SPEC-392 (L3) · perfil individual del profesional.
// SPEC-428 (L4): agrega precio estándar de primera cita + propagación del
// `expedienteId` que vino del expediente vivo (momento 4 del brief §9).
// SPEC-428 (M7): `heredarDe` marca el flujo «elegir otro sin volver a pagar».
// SPEC-440 (I-306 · Jelkin vivo 04-09): `u` y `pres` ya NO viajan en URL —
// `SolicitarCitaPanel` los lee del `sessionStorage` en cliente. La página
// server solo pasa IDs opacos.
import { notFound } from "next/navigation";
import { exigirPadre } from "@/lib/padre/guardia-padre";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { ProfesionalPerfil } from "@/components/modules/padre/profesionales/ProfesionalPerfil";
import { leerPrecioEstandarPrimeraCita } from "@/lib/profesional/cita/precio-primera-cita";
import { menoresPendientesDeAudienciaDelTitular } from "@/lib/dal/services/audiencia-menor";

export default async function PadreProfesionalPerfilPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ expedienteId?: string; heredarDe?: string }>;
}) {
    const user = await exigirPadre(); // SPEC-711: rol ≠ PARENT → su área (antes: redirect a "/")

    const { id } = await params;
    const { expedienteId, heredarDe } = await searchParams;

    // SPEC-441 · «volver al directorio» conserva el contexto — pero SOLO con IDs
    // opacos. SPEC-440 (I-306) sacó `u`/`pres` de la URL porque filtran PII de
    // menores; la urgencia y la presentación las restaura el directorio desde su
    // `sessionStorage`, no desde la barra de direcciones. Meterlas acá reabriría
    // esa fuga (y, tras 440, `u`/`pres` ya no existen en `searchParams`).
    const paramsVolver = new URLSearchParams();
    if (expedienteId) paramsVolver.set("expedienteId", expedienteId);
    if (heredarDe) paramsVolver.set("heredarDe", heredarDe);
    const hrefVolverQuery = paramsVolver.toString() ? `?${paramsVolver.toString()}` : "";

    const [perfil, precioEstandarPrimeraCitaCOP, pendientesAudiencia] = await Promise.all([
        new PerfilProfesionalRepository().obtenerPublicoPorId(id, user.id), // SPEC-655: visor de la sesión
        leerPrecioEstandarPrimeraCita(),
        // SPEC-751 T010 (§2): heads-up «oír al menor» en la cita. Solo el CONTEO (no nombres) —
        // la cita no es por-hijo, así que el renglón se enmarca por «tu hijo/tus hijos», sin PII.
        menoresPendientesDeAudienciaDelTitular(user.id),
    ]);
    if (!perfil) notFound();

    return (
        <ProfesionalPerfil
            p={perfil}
            precioEstandarPrimeraCitaCOP={precioEstandarPrimeraCitaCOP}
            expedienteIdSugerido={expedienteId}
            heredarDeSolicitudId={heredarDe}
            audienciasPendientes={pendientesAudiencia.length}
            /* SPEC-441: la vuelta al directorio conserva el contexto — expediente
               y reasignación por la URL (IDs opacos); urgencia y presentación las
               restaura el directorio de su sessionStorage (SPEC-440, sin PII). */
            hrefVolver={`/dashboard/padre/profesionales/directorio${hrefVolverQuery}`}
        />
    );
}
