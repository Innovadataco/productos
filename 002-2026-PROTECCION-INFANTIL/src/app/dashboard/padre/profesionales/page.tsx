// SPEC-392 (L3) · pantalla previa: el padre se presenta y marca urgencia.
// Ruta EXENTA de vigencia — el directorio no se esconde detrás del pago.
import { PresentacionUrgenciaForm } from "@/components/modules/padre/profesionales/PresentacionUrgenciaForm";

export default function PadreProfesionalesPage() {
    return <PresentacionUrgenciaForm hrefDirectorio="/dashboard/padre/profesionales/directorio" />;
}
