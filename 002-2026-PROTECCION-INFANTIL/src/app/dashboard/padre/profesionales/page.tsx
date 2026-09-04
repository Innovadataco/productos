// SPEC-392 (L3) · pantalla previa: el padre se presenta y marca urgencia.
// SPEC-428 (L4 M4): si viene con `?expedienteId=X` desde su expediente, se
// propaga hasta el pago para ofrecer «compartir expediente».
// SPEC-428 (M7): si viene con `?heredarDe=X`, es el flujo «elegir otro sin
// volver a pagar» — la cita nueva reasigna heredando el pago.
// Ruta EXENTA de vigencia — el directorio no se esconde detrás del pago.
import { PresentacionUrgenciaForm } from "@/components/modules/padre/profesionales/PresentacionUrgenciaForm";

export default async function PadreProfesionalesPage({
    searchParams,
}: {
    searchParams: Promise<{ expedienteId?: string; heredarDe?: string }>;
}) {
    const { expedienteId, heredarDe } = await searchParams;
    return (
        <PresentacionUrgenciaForm
            hrefDirectorio="/dashboard/padre/profesionales/directorio"
            {...(expedienteId ? { expedienteIdInicial: expedienteId } : {})}
            {...(heredarDe ? { heredarDeInicial: heredarDe } : {})}
        />
    );
}
